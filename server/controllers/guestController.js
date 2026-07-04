import Guest from '../models/Guest.js';
import { upsertGuest } from '../services/guestDirectory.js';

export const getAllGuests = async (_req, res) => {
  try {
    const guests = await Guest.find().sort({ createdAt: -1 });
    res.json(guests);
  } catch (error) {
    console.error('Error fetching guests:', error);
    res.status(500).json({ message: error.message });
  }
};

export const searchGuests = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'i');

    const guests = await Guest.find({
      $or: [{ name: rx }, { email: rx }, { phone: rx }],
    }).sort({ createdAt: -1 });

    res.json(guests);
  } catch (error) {
    console.error('Error searching guests:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getGuestById = async (req, res) => {
  try {
    const guest = await Guest.findById(req.params.id);
    if (!guest) return res.status(404).json({ message: 'Guest not found' });
    res.json(guest);
  } catch (error) {
    console.error('Error fetching guest:', error);
    res.status(500).json({ message: error.message });
  }
};

export const createGuest = async (req, res) => {
  try {
    // Dedupe on the normalized phone so re-adding an existing guest updates their
    // record instead of creating a country-code twin.
    const newGuest = await upsertGuest(req.body);
    res.status(201).json(newGuest);
  } catch (error) {
    console.error('Error creating guest:', error);
    res.status(400).json({ message: error.message });
  }
};

export const updateGuest = async (req, res) => {
  try {
    const guest = await Guest.findByIdAndUpdate(
      req.params.id,
      req.body,
      { returnDocument: 'after', runValidators: true }
    );
    if (!guest) return res.status(404).json({ message: 'Guest not found' });
    res.json(guest);
  } catch (error) {
    console.error('Error updating guest:', error);
    res.status(400).json({ message: error.message });
  }
};

export const deleteGuest = async (req, res) => {
  try {
    const guest = await Guest.findByIdAndDelete(req.params.id);
    if (!guest) return res.status(404).json({ message: 'Guest not found' });
    res.json({ message: 'Guest deleted successfully' });
  } catch (error) {
    console.error('Error deleting guest:', error);
    res.status(500).json({ message: error.message });
  }
};
