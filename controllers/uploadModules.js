const pool = require('../config/db');

const uploadModules = async (req, res) => {
  try {
    const { moduleName, fields } = req.body;

    // Validate moduleName
    if (!moduleName || typeof moduleName !== 'string') {
      return res.status(400).json({ error: 'Module name is required and must be a string' });
    }

    // Validate and process fields
    let processedFields;
    
    if (!fields) {
      return res.status(400).json({ error: 'Fields are required' });
    }

    // If fields is a string, try to parse it
    if (typeof fields === 'string') {
      try {
        processedFields = JSON.parse(fields);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        return res.status(400).json({ error: 'Invalid JSON format for fields' });
      }
    } else if (Array.isArray(fields)) {
      // If it's already an array, use it directly
      processedFields = fields;
    } else {
      return res.status(400).json({ error: 'Fields must be an array or valid JSON string' });
    }

    // Ensure processedFields is an array
    if (!Array.isArray(processedFields)) {
      return res.status(400).json({ error: 'Fields must be an array' });
    }

    console.log('Module Name:', moduleName);
    console.log('Processed Fields:', JSON.stringify(processedFields, null, 2));

    // Check if module already exists
    const existingModule = await pool.query(
      'SELECT id FROM form_modules WHERE module_name = $1',
      [moduleName]
    );

    let result;
    if (existingModule.rows.length > 0) {
      // Update existing module 
      const updateQuery = `
        UPDATE form_modules 
        SET fields = $2, updated_at = NOW()
        WHERE module_name = $1
        RETURNING *
      `;
      result = await pool.query(updateQuery, [moduleName, JSON.stringify(processedFields)]);
    } else {
      // Insert new module - without module_order for now
      const insertQuery = `
        INSERT INTO form_modules (module_name, fields, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
        RETURNING *
      `;
      result = await pool.query(insertQuery, [moduleName, JSON.stringify(processedFields)]);
    }

    res.status(200).json({ 
      message: 'Module saved successfully', 
      module: result.rows[0] 
    });

  } catch (error) {
    console.error('Error saving module:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getModuleFields = async (req, res) => {
  try {
    const { moduleName } = req.params;
    
    if (!moduleName) {
      return res.status(400).json({ error: 'Module name is required' });
    }

    console.log('Fetching fields for module:', moduleName);

    const result = await pool.query(
      'SELECT fields FROM form_modules WHERE module_name = $1',
      [moduleName]
    );

    if (result.rows.length === 0) {
      return res.status(200).json({ fields: [] });
    }

    // Parse the JSON fields from database
    const fields = result.rows[0].fields;
    let parsedFields;

    if (typeof fields === 'string') {
      try {
        parsedFields = JSON.parse(fields);
      } catch (parseError) {
        console.error('Error parsing fields from database:', parseError);
        return res.status(500).json({ error: 'Invalid field data in database' });
      }
    } else {
      parsedFields = fields;
    }

    res.json({ fields: parsedFields });

  } catch (error) {
    console.error('Error fetching fields:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const uploadSearchData = async (req, res) => {
  try {
    const { moduleName, fieldIndex, jsonData, fileName } = req.body;

    // Validate required fields
    if (!moduleName || fieldIndex === undefined || !jsonData) {
      return res.status(400).json({ error: 'Module name, field index, and JSON data are required' });
    }

    console.log('Uploading search data:', { moduleName, fieldIndex, fileName });

    // Check if search_data table exists, create if not
    await pool.query(`
      CREATE TABLE IF NOT EXISTS search_data (
        id SERIAL PRIMARY KEY,
        module_name VARCHAR(255) NOT NULL,
        field_index INTEGER NOT NULL,
        file_name VARCHAR(255),
        json_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(module_name, field_index)
      )
    `);

    // Insert or update search data
    const upsertQuery = `
      INSERT INTO search_data (module_name, field_index, file_name, json_data, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (module_name, field_index)
      DO UPDATE SET 
        file_name = EXCLUDED.file_name,
        json_data = EXCLUDED.json_data,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await pool.query(upsertQuery, [
      moduleName, 
      fieldIndex, 
      fileName || 'unknown.json', 
      JSON.stringify(jsonData)
    ]);

    res.status(200).json({
      message: 'Search data uploaded successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error uploading search data:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get search data for a specific field
const getSearchData = async (req, res) => {
  try { 
    const { moduleName, fieldIndex } = req.params;

    if (!moduleName || fieldIndex === undefined) {
      return res.status(400).json({ error: 'Module name and field index are required' });
    }

    const result = await pool.query(
      'SELECT json_data, file_name FROM search_data WHERE module_name = $1 AND field_index = $2',
      [moduleName, parseInt(fieldIndex)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Search data not found' });
    }

    const { json_data, file_name } = result.rows[0];
    
    res.json({
      fileName: file_name,
      data: json_data
    });

  } catch (error) {
    console.error('Error fetching search data:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Improved search within uploaded JSON data with better text matching
const searchData = async (req, res) => {
  try {
    const { moduleName, fieldIndex } = req.params;
    const { query, maxResults = 10 } = req.query;

    if (!moduleName || fieldIndex === undefined) {
      return res.status(400).json({ error: 'Module name and field index are required' });
    }

    // Get the JSON data from database
    const result = await pool.query(
      'SELECT json_data FROM search_data WHERE module_name = $1 AND field_index = $2',
      [moduleName, parseInt(fieldIndex)]
    );

    if (result.rows.length === 0) {
      return res.json({
        results: [],
        total: 0,
        message: 'No search data available for this field'
      });
    }

    let searchData = result.rows[0].json_data;
    
    // Ensure it's an array
    if (!Array.isArray(searchData)) {
      searchData = [searchData];
    }

    // If no query, return limited results
    if (!query || query.trim() === '') {
      return res.json({
        results: searchData.slice(0, parseInt(maxResults)),
        total: searchData.length
      });
    }

    const searchTerm = query.toLowerCase().trim();
    
    // Enhanced search function that handles complex objects
    const searchInObject = (item, searchTerm) => {
      if (!item) return { matches: false, score: 0, matchedFields: [] };
      
      let matches = false;
      let score = 0;
      let matchedFields = [];
      
      if (typeof item === 'string') {
        const itemLower = item.toLowerCase();
        if (itemLower.includes(searchTerm)) {
          matches = true;
          // Higher score for exact matches or matches at the beginning
          if (itemLower === searchTerm) score = 100;
          else if (itemLower.startsWith(searchTerm)) score = 80;
          else score = 60;
          matchedFields.push('text');
        }
      } else if (typeof item === 'object' && item !== null) {
        // Search in all string values of the object
        Object.entries(item).forEach(([key, value]) => {
          if (value && typeof value === 'string') {
            const valueLower = value.toLowerCase();
            if (valueLower.includes(searchTerm)) {
              matches = true;
              matchedFields.push(key);
              
              // Different scoring based on field importance and match type
              let fieldScore = 0;
              if (valueLower === searchTerm) fieldScore = 100;
              else if (valueLower.startsWith(searchTerm)) fieldScore = 80;
              else fieldScore = 60;
              
              // Boost score for important fields
              if (['name', 'title', 'label'].includes(key.toLowerCase())) {
                fieldScore *= 1.5;
              } else if (['address', 'location'].includes(key.toLowerCase())) {
                fieldScore *= 1.2;
              } else if (['phone', 'email'].includes(key.toLowerCase())) {
                fieldScore *= 1.1;
              }
              
              score = Math.max(score, fieldScore);
            }
          }
        });
      }
      
      return { matches, score, matchedFields };
    };

    // Filter and score results
    const scoredResults = searchData
      .map(item => {
        const searchResult = searchInObject(item, searchTerm);
        return {
          item,
          ...searchResult
        };
      })
      .filter(result => result.matches)
      .sort((a, b) => {
        // Sort by score (higher first), then by relevance
        if (b.score !== a.score) return b.score - a.score;
        
        // Secondary sorting: prefer items with matches in name/title fields
        const aHasNameMatch = a.matchedFields.some(field => 
          ['name', 'title', 'label'].includes(field.toLowerCase())
        );
        const bHasNameMatch = b.matchedFields.some(field => 
          ['name', 'title', 'label'].includes(field.toLowerCase())
        );
        
        if (aHasNameMatch && !bHasNameMatch) return -1;
        if (!aHasNameMatch && bHasNameMatch) return 1;
        
        return 0;
      })
      .slice(0, parseInt(maxResults))
      .map(result => result.item);

    res.json({
      results: scoredResults,
      total: scoredResults.length,
      query: query,
      totalMatches: scoredResults.length
    });

  } catch (error) {
    console.error('Error searching data:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to search data'
    });
  }
};

// Add a new function to check if search data exists for debugging
const checkSearchDataExists = async (req, res) => {
  try {
    const { moduleName, fieldIndex } = req.params;
    
    const result = await pool.query(
      'SELECT module_name, field_index, file_name, created_at FROM search_data WHERE module_name = $1 AND field_index = $2',
      [moduleName, parseInt(fieldIndex)]
    );

    if (result.rows.length === 0) {
      // Check what data exists for this module
      const moduleData = await pool.query(
        'SELECT module_name, field_index, file_name FROM search_data WHERE module_name = $1',
        [moduleName]
      );
      
      return res.json({
        exists: false,
        message: `No search data found for ${moduleName} field ${fieldIndex}`,
        availableFields: moduleData.rows
      });
    }

    res.json({
      exists: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error checking search data:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Function to get all available search data (for debugging)
const getAllSearchData = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT module_name, field_index, file_name, created_at FROM search_data ORDER BY module_name, field_index'
    );

    res.json({
      searchData: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    console.error('Error fetching all search data:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Check if module_order column exists
const checkModuleOrderColumn = async () => {
  try {
    const result = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'form_modules' AND column_name = 'module_order'
    `);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking module_order column:', error);
    return false;
  }
};

const getAllModules = async (req, res) => {
  try {
    // Check if module_order column exists
    const hasModuleOrder = await checkModuleOrderColumn();
    
    let query;
    if (hasModuleOrder) {
      query = `
        SELECT 
          module_name, 
          created_at, 
          updated_at,
          module_order,
          CASE 
            WHEN fields IS NULL THEN 0
            WHEN fields = '[]' THEN 0
            ELSE COALESCE(jsonb_array_length(fields::jsonb), 0)
          END as field_count
        FROM form_modules 
        ORDER BY COALESCE(module_order, 999999), updated_at DESC
      `;
    } else {
      query = `
        SELECT 
          module_name, 
          created_at, 
          updated_at,
          CASE 
            WHEN fields IS NULL THEN 0
            WHEN fields = '[]' THEN 0
            ELSE COALESCE(jsonb_array_length(fields::jsonb), 0)
          END as field_count
        FROM form_modules 
        ORDER BY updated_at DESC
      `;
    }

    const result = await pool.query(query);
    
    res.status(200).json({ 
      modules: result.rows,
      count: result.rows.length 
    });

  } catch (error) {
    console.error('Error fetching all modules:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteModule = async (req, res) => {
  try {
    const { moduleName } = req.params;
    
    if (!moduleName) {
      return res.status(400).json({ error: 'Module name is required' });
    }

    console.log('Deleting module:', moduleName);

    // Start transaction
    await pool.query('BEGIN');

    try {
      // Delete associated search data first
      await pool.query(
        'DELETE FROM search_data WHERE module_name = $1',
        [moduleName]
      );

      // Delete the module
      const result = await pool.query(
        'DELETE FROM form_modules WHERE module_name = $1 RETURNING *',
        [moduleName]
      );

      if (result.rows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ error: 'Module not found' });
      }

      // Commit transaction
      await pool.query('COMMIT');

      res.status(200).json({ 
        message: 'Module and associated data deleted successfully',
        deletedModule: result.rows[0].module_name 
      });

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error deleting module:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Rename Module
const renameModule = async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    
    if (!oldName || !newName) {
      return res.status(400).json({ error: 'Both old name and new name are required' });
    }

    if (oldName.trim() === newName.trim()) {
      return res.status(400).json({ error: 'New name must be different from old name' });
    }

    // Start transaction
    await pool.query('BEGIN');

    try {
      // Check if old module exists
      const existingModule = await pool.query(
        'SELECT id FROM form_modules WHERE module_name = $1',
        [oldName]
      );

      if (existingModule.rows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ error: 'Module not found' });
      }

      // Check if new name already exists
      const duplicateModule = await pool.query(
        'SELECT id FROM form_modules WHERE module_name = $1 AND module_name != $2',
        [newName.trim(), oldName]
      );

      if (duplicateModule.rows.length > 0) {
        await pool.query('ROLLBACK');
        return res.status(409).json({ error: 'Module with this name already exists' });
      }

      // Update search data module names
      await pool.query(
        'UPDATE search_data SET module_name = $1 WHERE module_name = $2',
        [newName.trim(), oldName]
      );

      // Update module name
      const result = await pool.query(
        'UPDATE form_modules SET module_name = $1, updated_at = NOW() WHERE module_name = $2 RETURNING *',
        [newName.trim(), oldName]
      );

      // Commit transaction
      await pool.query('COMMIT');

      res.status(200).json({ 
        message: 'Module renamed successfully',
        module: result.rows[0]
      });

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error renaming module:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update Module Order - with column check
const updateModuleOrder = async (req, res) => {
  try {
    const { modules } = req.body;
    
    if (!modules || !Array.isArray(modules)) {
      return res.status(400).json({ error: 'Modules array is required' });
    }

    // Check if module_order column exists
    const hasModuleOrder = await checkModuleOrderColumn();
    
    if (!hasModuleOrder) {
      return res.status(400).json({ 
        error: 'Module ordering not supported. Please run database migration first.' 
      });
    }

    console.log('Updating module order:', modules);

    // Start transaction
    await pool.query('BEGIN');

    try {
      // Update each module's order
      for (let i = 0; i < modules.length; i++) {
        const { module_name, order } = modules[i];
        
        await pool.query(
          'UPDATE form_modules SET module_order = $1, updated_at = NOW() WHERE module_name = $2',
          [order !== undefined ? order : i, module_name]
        );
      }

      // Commit transaction
      await pool.query('COMMIT');

      res.status(200).json({ 
        message: 'Module order updated successfully',
        updatedCount: modules.length
      });

    } catch (error) {
      // Rollback transaction on error
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error updating module order:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete search data for a specific field
const deleteSearchData = async (req, res) => {
  try {
    const { moduleName, fieldIndex } = req.params;

    if (!moduleName || fieldIndex === undefined) {
      return res.status(400).json({ error: 'Module name and field index are required' });
    }

    const result = await pool.query(
      'DELETE FROM search_data WHERE module_name = $1 AND field_index = $2 RETURNING *',
      [moduleName, parseInt(fieldIndex)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Search data not found' });
    }

    res.status(200).json({ 
      message: 'Search data deleted successfully',
      deletedData: result.rows[0]
    });

  } catch (error) {
    console.error('Error deleting search data:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { 
  uploadModules, 
  getModuleFields, 
  getAllModules, 
  deleteModule,
  renameModule,
  updateModuleOrder,
  uploadSearchData,
  getSearchData,
  searchData,
  deleteSearchData,
  checkSearchDataExists,
  getAllSearchData
};