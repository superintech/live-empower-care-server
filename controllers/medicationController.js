const pool = require('../config/db');

// Save or update thank you page
exports.saveThankYouPage = async (req, res) => {
  const { fields } = req.body;

  const pageName = 'Medication'

  if (!pageName || !fields) {
    return res.status(400).json({ error: 'Page name and fields are required' });
  }

  try { 
    const checkResult = await pool.query(
      'SELECT id FROM thank_you WHERE page_name = $1',
      [pageName]
    );

    if (checkResult.rows.length > 0) {
      const updateResult = await pool.query(
        'UPDATE thank_you SET field = $1, updated_at = CURRENT_TIMESTAMP WHERE page_name = $2 RETURNING *',
        [JSON.stringify(fields), pageName]
      );
      res.json({ message: 'Thank you page updated successfully', data: updateResult.rows[0] });
    } else {
      const insertResult = await pool.query(
        'INSERT INTO thank_you (page_name, field) VALUES ($1, $2) RETURNING *',
        [pageName, JSON.stringify(fields)]
      );
      res.json({ message: 'Thank you page saved successfully', data: insertResult.rows[0] });
    }
  } catch (error) {
    console.error('Error saving thank you page:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// Get single thank you page
exports.getThankYouPage = async (req, res) => {
  const { pageName } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM thank_you WHERE page_name = $1',
      [pageName]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching thank you page:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all thank you pages
exports.getAllThankYouPages = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, page_name, created_at, updated_at FROM thank_you ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching thank you pages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete thank you page
exports.deleteThankYouPage = async (req, res) => {
  const { pageName } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM thank_you WHERE page_name = $1 RETURNING *',
      [pageName]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json({ message: 'Page deleted successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Error deleting thank you page:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
