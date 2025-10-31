const pool = require('../config/db');

// Create a new form field
const createEvent = async (label_name, placeholder_name, type, options) => {
  const query = `
    INSERT INTO form_fields (label_name, placeholder_name, type, options)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  const values = [
    label_name,
    placeholder_name,
    type,
    options ? JSON.stringify(options) : null
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};


const getAllEvents = async () => {
  const result = await pool.query(
    `SELECT * FROM form_fields ORDER BY position ASC NULLS LAST, id DESC`
  );
  return result.rows;
};

// Update label name
const updateEvent = async (id, label_name) => {
  try {
    const result = await pool.query(
      'UPDATE form_fields SET label_name = $1 WHERE id = $2',
      [label_name, id]
    );
    console.log('Update result:', result.rowCount);
    return result.rowCount;
  } catch (err) {
    console.error('DB Error in updateEvent:', err.stack);
    throw err;
  }
};

// Delete a form field
const deleteEvent = async (id) => {
  try {
    await pool.query('DELETE FROM form_fields WHERE id = $1', [id]);
  } catch (err) {
    console.error('DB Error in deleteEvent:', err.stack);
    throw err;
  }
};

// Update the order (position)
const updateEventOrder = async (orderedIds) => {
  try {
    const queries = orderedIds.map((id, index) => {
      return pool.query(
        'UPDATE form_fields SET position = $1 WHERE id = $2',
        [index, id]
      );
    });
    await Promise.all(queries);
  } catch (err) {
    console.error('DB Error in updateEventOrder:', err.stack);
    throw err;
  }
};

module.exports = {
  createEvent,
  getAllEvents,
  updateEvent,
  deleteEvent,
  updateEventOrder
};
