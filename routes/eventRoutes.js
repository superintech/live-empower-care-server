// routes/eventRoutes.js
const express = require('express');
const router = express.Router();
const {
  createEvent,
  getAllEvents,
  updateEvent,
  deleteEvent,
  updateEventOrder
} = require('../models/eventModel');

// Add event
router.post('/events/add', async (req, res) => {
  const { name, placeholder, type, options } = req.body;

  console.log('Received options ===>', options); // Debugging

  if (!name || !type) {
    return res.status(400).json({ message: 'Label name and type are required' });
  }

  try {
    const newField = await createEvent(name, placeholder, type, options);
    res.json(newField);
  } catch (err) {
    console.error('Error in POST /events/add:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});


// Get all events
router.get('/events', async (req, res) => {
  try {
    const events = await getAllEvents();
    res.json(events);
  } catch (err) {
    console.error('Error in GET /events:', err.stack);
    res.status(500).json({ error: 'Error fetching events' });
  }
});

// Delete event
router.delete('/events/:id', async (req, res) => {
  try {
    await deleteEvent(req.params.id);
    res.json({ message: 'Event deleted' });
  } catch (err) {
    console.error('Error in DELETE /events/:id:', err.stack);
    res.status(500).json({ error: 'Error deleting event' });
  }
});

router.put('/events/reorder', async (req, res) => {
  try {
    const { orderedIds } = req.body;
    console.log('Reordering events with IDs:', orderedIds);

    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds must be an array' });
    }

    await updateEventOrder(orderedIds);
    res.json({ message: 'Order updated successfully' });
  } catch (err) {
    console.error('Error in PUT /events/reorder:', err.stack);
    res.status(500).json({ error: 'Error updating order' });
  }
});

router.put('/events/:id', async (req, res) => {
  try {
    const { name } = req.body;
    await updateEvent(req.params.id, name);
    res.json({ message: 'Event updated' });
  } catch (err) {
    console.error('Error in PUT /events/:id:', err.stack);
    res.status(500).json({ error: 'Error updating event' });
  }
});

module.exports = router;
