import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Grid, Typography, FormControl, InputLabel, Select,
  MenuItem, TextField, Snackbar, Alert,
} from '@mui/material';
import {
  Edit as EditIcon,
  CleaningServices as CleaningIcon,
  PendingActionsOutlined,
  AutorenewOutlined,
  CheckCircleOutlined,
  FactCheckOutlined,
  HotelOutlined,
  BuildOutlined,
} from '@mui/icons-material';
import { format } from 'date-fns';
import PageLayout from '../../components/layout/PageLayout';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import FormDialog, { FormSection } from '../../components/forms/FormDialog';
import AppDateTimePicker from '../../components/forms/AppDateTimePicker';
import api from '../../api';
import { useHousekeeping } from '../../contexts/HousekeepingContext';
import { useSettings } from '../../contexts/SettingsContext';

import HkHeader from './housekeeping/HkHeader';
import HkKpiCard from './housekeeping/HkKpiCard';
import RoomStatusBoard from './housekeeping/RoomStatusBoard';
import TasksTable from './housekeeping/TasksTable';
import StaffPanel from './housekeeping/StaffPanel';
import HkCharts from './housekeeping/HkCharts';
import {
  TASK_STATUS, PRIORITY_LEVELS, TASK_TYPES, HK,
  deriveRoomStatus, staffName,
} from './housekeeping/hkConstants';

const initialFormData = {
  locationType: 'room', // 'room' | 'hall'
  roomId: '',
  hallId: '',
  taskType: 'Regular Cleaning',
  description: '',
  assignedTo: '',
  priority: 'Medium',
  status: 'Pending',
  notes: '',
  scheduledFor: format(new Date(), 'yyyy-MM-dd\'T\'HH:mm'),
};

// ── small date helpers ──────────────────────────────────────────────────────
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const isSameDay = (a, b) => Boolean(a) && Boolean(b) && startOfDay(a).getTime() === startOfDay(b).getTime();
const roomIdOf = (t) => (t.roomId && typeof t.roomId === 'object' ? t.roomId._id : t.roomId) || null;
const assignedIdOf = (t) => (t.assignedTo && typeof t.assignedTo === 'object' ? t.assignedTo._id : t.assignedTo) || null;

const Housekeepings = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const isDark = Boolean(settings?.theme?.darkMode);
  const { loading: contextLoading } = useHousekeeping();

  const [tasks, setTasks] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [halls, setHalls] = useState([]);
  const [staff, setStaff] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const showSnackbar = useCallback((message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleCloseDialog = useCallback(() => {
    setOpenDialog(false);
    setSelectedTask(null);
    setFormData(initialFormData);
  }, []);

  // Open the dialog to EDIT an existing task.
  const handleEdit = useCallback((task) => {
    setSelectedTask(task);
    const hallIdValue = task.hallId?._id || task.hallId || '';
    const roomIdValue = task.roomId?._id || task.roomId || '';
    setFormData({
      ...task,
      locationType: hallIdValue ? 'hall' : 'room',
      roomId: roomIdValue,
      hallId: hallIdValue,
      assignedTo: task.assignedTo?._id || task.assignedTo || '',
      scheduledFor: format(new Date(task.scheduledFor), 'yyyy-MM-dd\'T\'HH:mm'),
    });
    setOpenDialog(true);
  }, []);

  // Open the dialog to CREATE a task, optionally pre-set to a task type / room.
  const handleCreate = useCallback((preset = null, room = null) => {
    setSelectedTask(null);
    setFormData({
      ...initialFormData,
      scheduledFor: format(new Date(), 'yyyy-MM-dd\'T\'HH:mm'),
      ...(preset ? { taskType: preset } : {}),
      ...(room ? { locationType: 'room', roomId: room._id || '' } : {}),
    });
    setOpenDialog(true);
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const response = await api.housekeeping.getAll();
      let apiTasks = [];
      if (response?.data) {
        if (Array.isArray(response.data)) apiTasks = response.data;
        else if (Array.isArray(response.data.data)) apiTasks = response.data.data;
      }
      setTasks(apiTasks);
    } catch (error) {
      setTasks([]);
      showSnackbar('Failed to fetch tasks', 'error');
    }
  }, [showSnackbar]);

  const fetchRooms = useCallback(async () => {
    try {
      const response = await api.rooms.getAll();
      setRooms(Array.isArray(response?.data) ? response.data : []);
    } catch (error) {
      setRooms([]);
      showSnackbar('Failed to fetch rooms', 'error');
    }
  }, [showSnackbar]);

  const fetchHalls = useCallback(async () => {
    try {
      const response = await api.banquet.getHalls();
      const data = response?.data?.data || response?.data;
      setHalls(Array.isArray(data) ? data : []);
    } catch (error) {
      setHalls([]);
    }
  }, []);

  const fetchStaff = useCallback(async () => {
    try {
      const usersResponse = await api.users.getAll();
      const responseData = usersResponse?.data?.data || usersResponse?.data;
      const allUsers = Array.isArray(responseData) ? responseData : [];
      if (allUsers.length === 0) { setStaff([]); return; }
      const housekeepingUsers = allUsers.filter(user =>
        (user.role?.name && /housekeep/i.test(user.role.name)) ||
        (user.department?.name && /housekeep/i.test(user.department.name)),
      );
      setStaff(housekeepingUsers.length > 0 ? housekeepingUsers : allUsers);
    } catch (userError) {
      try {
        const staffResponse = await api.staff.getAll();
        const allStaff = Array.isArray(staffResponse?.data) ? staffResponse.data : [];
        setStaff(allStaff);
      } catch (staffError) {
        setStaff([]);
        showSnackbar('Failed to fetch staff data', 'error');
      }
    }
  }, [showSnackbar]);

  const fetchBookings = useCallback(async () => {
    try {
      const response = await api.bookings.getAll();
      const data = response?.data?.data || response?.data;
      setBookings(Array.isArray(data) ? data : []);
    } catch (error) {
      setBookings([]);
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchTasks(), fetchRooms(), fetchHalls(), fetchStaff(), fetchBookings()]);
      } finally {
        setLoading(false);
      }
    };
    initialize();
  }, [fetchTasks, fetchRooms, fetchHalls, fetchStaff, fetchBookings]);

  const handleCompleteTask = async (taskId) => {
    const task = tasks.find(t => t._id === taskId);
    if (!task) { showSnackbar('Task not found', 'error'); return; }
    setTasks(prev => prev.map(t => (t._id === taskId ? { ...t, status: 'Completed' } : t)));
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/housekeeping/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'Completed', completedAt: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      showSnackbar('Task marked as completed', 'success');
      // The server flips the room back to "available" on completion — refetch
      // rooms too so the Room Status Board leaves "Cleaning" and shows Clean.
      fetchTasks();
      fetchRooms();
    } catch (error) {
      setTasks(prev => prev.map(t => (t._id === taskId ? { ...t, status: task.status } : t)));
      showSnackbar('Failed to complete task', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isHall = formData.locationType === 'hall';
    if (!formData.taskType || (isHall ? !formData.hallId : !formData.roomId)) {
      showSnackbar(`Please select a ${isHall ? 'banquet hall' : 'room'} and task type`, 'error');
      return;
    }
    try {
      if (formData.assignedTo && formData.assignedTo.trim() !== '') {
        if (!/^[0-9a-fA-F]{24}$/.test(formData.assignedTo)) {
          showSnackbar('Invalid staff selection. Please choose a valid staff member.', 'error');
          return;
        }
      }
      const submitData = {
        ...formData,
        assignedTo: formData.assignedTo && formData.assignedTo.trim() !== '' ? formData.assignedTo : null,
      };
      if (submitData.assignedTo === null) delete submitData.assignedTo;
      if (isHall) { submitData.hallId = formData.hallId; submitData.roomId = null; }
      else { submitData.roomId = formData.roomId; submitData.hallId = null; }
      delete submitData.locationType;

      if (selectedTask?._id) await api.housekeeping.update(selectedTask._id, submitData);
      else await api.housekeeping.create(submitData);

      // Refetch rooms as well: completing a task via the editor resets the
      // room to available on the server, and the board derives from room status.
      await Promise.all([fetchTasks(), fetchRooms()]);
      handleCloseDialog();
      showSnackbar(selectedTask ? 'Task updated successfully' : 'Task created successfully');
    } catch (error) {
      showSnackbar(error.response?.data?.message || 'Failed to save task', 'error');
    }
  };

  const confirmDelete = async () => {
    const taskId = deleteTarget;
    if (!taskId) return;
    try {
      setDeleting(true);
      await api.housekeeping.delete(taskId);
      setTasks(prev => prev.filter(t => t._id !== taskId));
      showSnackbar('Task deleted successfully');
      setDeleteTarget(null);
    } catch (error) {
      showSnackbar(error.response?.data?.message || 'Failed to delete task', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // ── derived label helpers ──────────────────────────────────────────────
  const getLocationLabel = useCallback((task) => {
    if (task.hallId) {
      const name = (typeof task.hallId === 'object' && task.hallId.name)
        ? task.hallId.name
        : halls.find(h => h._id === task.hallId)?.name;
      return name ? `Hall: ${name}` : 'Banquet Hall';
    }
    if (task.roomId && typeof task.roomId === 'object' && task.roomId.roomNumber) {
      return `Room ${task.roomId.roomNumber}`;
    }
    const room = rooms.find(r => r._id === task.roomId);
    return room ? `Room ${room.roomNumber}` : 'N/A';
  }, [rooms, halls]);

  const resolveStaffName = useCallback((task) => {
    const a = task.assignedTo;
    if (a && typeof a === 'object') return staffName(a) || 'Unknown';
    if (a) { const m = staff.find(s => String(s._id) === String(a)); return m ? (staffName(m) || m.username || '') : ''; }
    return '';
  }, [staff]);

  // Current occupant per room: the checked-in, not-yet-checked-out booking.
  // Keyed by room id → { name, at } (newest check-in wins if a room has more
  // than one match). A room is only "occupied" when a booking is checkedIn.
  const guestByRoom = useMemo(() => {
    const m = new Map();
    bookings.forEach((b) => {
      if (!b.checkedIn || b.checkedOutAt || !b.guestName) return;
      const rid = b.roomId && typeof b.roomId === 'object' ? b.roomId._id : b.roomId;
      if (!rid) return;
      const at = b.checkedInAt || b.checkIn || 0;
      const prev = m.get(String(rid));
      if (!prev || new Date(at) > new Date(prev.at || 0)) m.set(String(rid), { name: b.guestName, at });
    });
    return m;
  }, [bookings]);

  const guestOf = useCallback((task) => {
    const rid = roomIdOf(task);
    const occ = rid ? guestByRoom.get(String(rid)) : null;
    if (occ?.name) return occ.name;
    if (task.guestName) return task.guestName;
    if (task.roomId && typeof task.roomId === 'object') return task.roomId.currentGuest?.name || task.roomId.guestName || '';
    return '';
  }, [guestByRoom]);

  // ── metrics & derived data ─────────────────────────────────────────────
  const taskByRoom = useMemo(() => {
    const m = new Map();
    tasks.forEach((t) => {
      if (t.status === 'Completed' || t.status === 'Cancelled') return;
      const rid = roomIdOf(t);
      if (!rid) return;
      const prev = m.get(String(rid));
      if (!prev || new Date(t.scheduledFor || 0) > new Date(prev.scheduledFor || 0)) m.set(String(rid), t);
    });
    return m;
  }, [tasks]);

  const annotatedRooms = useMemo(
    () => rooms.map(r => ({
      ...r,
      hkStatus: deriveRoomStatus(r, taskByRoom.get(String(r._id))),
      occupant: guestByRoom.get(String(r._id))?.name || '',
    })),
    [rooms, taskByRoom, guestByRoom],
  );

  const staffStats = useMemo(() => {
    const map = new Map();
    staff.forEach((m) => map.set(String(m._id), {
      _id: m._id,
      name: staffName(m) || m.username || 'Staff',
      role: m.role?.name || m.position || (typeof m.role === 'string' ? m.role : ''),
      assigned: 0,
      completed: 0,
    }));
    tasks.forEach((t) => {
      const id = assignedIdOf(t);
      if (!id) return;
      let row = map.get(String(id));
      if (!row) {
        row = { _id: id, name: staffName(t.assignedTo) || 'Staff', role: '', assigned: 0, completed: 0 };
        map.set(String(id), row);
      }
      if (t.status === 'Completed') row.completed += 1;
      else if (t.status !== 'Cancelled') row.assigned += 1;
    });
    return Array.from(map.values())
      .sort((a, b) => (b.assigned + b.completed) - (a.assigned + a.completed))
      .slice(0, 8);
  }, [staff, tasks]);

  const tableRows = useMemo(() => {
    const statusRank = { 'In Progress': 0, Pending: 1, Completed: 2, Cancelled: 3 };
    const prioRank = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
    return tasks.map((t) => ({
      _id: t._id,
      room: getLocationLabel(t),
      guest: guestOf(t),
      task: t.taskType || 'Task',
      staff: resolveStaffName(t),
      priority: t.priority || 'Medium',
      status: t.status || 'Pending',
      canComplete: t.status !== 'Completed',
      raw: t,
    })).sort((a, b) => {
      const s = (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
      if (s) return s;
      return (prioRank[a.priority] ?? 9) - (prioRank[b.priority] ?? 9);
    });
  }, [tasks, getLocationLabel, resolveStaffName, guestOf]);

  const metrics = useMemo(() => {
    const total = tasks.length || 1;
    const totalRooms = rooms.length || 1;
    const pending = tasks.filter(t => t.status === 'Pending').length;
    const inProgress = tasks.filter(t => t.status === 'In Progress').length;
    const completedAll = tasks.filter(t => t.status === 'Completed').length;
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const completedToday = tasks.filter(t => t.status === 'Completed' && isSameDay(t.completedAt || t.scheduledFor, new Date())).length;
    const completedYesterday = tasks.filter(t => t.status === 'Completed' && isSameDay(t.completedAt || t.scheduledFor, yesterday)).length;
    const inspection = tasks.filter(t => t.taskType === 'Inspection' && t.status !== 'Completed').length;
    const maintenance = tasks.filter(t => t.taskType === 'Maintenance' && t.status !== 'Completed').length;
    const dirty = annotatedRooms.filter(r => r.hkStatus === 'dirty').length;
    const occupied = rooms.filter(r => r.status === 'occupied').length;
    const activeStaff = staffStats.filter(s => s.assigned > 0).length;
    const completionRate = tasks.length ? Math.round((completedAll / tasks.length) * 100) : 0;

    const durations = tasks
      .filter(t => t.status === 'Completed' && t.completedAt && t.scheduledFor)
      .map(t => (new Date(t.completedAt) - new Date(t.scheduledFor)) / 60000)
      .filter(mn => mn > 0 && mn < 60 * 24);
    const turnaroundMin = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

    const trendPct = completedYesterday > 0
      ? Math.round(((completedToday - completedYesterday) / completedYesterday) * 100)
      : (completedToday > 0 ? 100 : 0);

    return {
      total, totalRooms, pending, inProgress, completedAll, completedToday,
      inspection, maintenance, dirty, occupied, activeStaff, completionRate, turnaroundMin,
      trend: `${trendPct >= 0 ? '+' : ''}${trendPct}%`,
      trendUp: trendPct >= 0,
    };
  }, [tasks, rooms, annotatedRooms, staffStats]);

  const weekly = useMemo(() => {
    const out = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = startOfDay(new Date());
      d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const completed = tasks.filter((t) => {
        if (t.status !== 'Completed') return false;
        const c = t.completedAt ? new Date(t.completedAt) : (t.scheduledFor ? new Date(t.scheduledFor) : null);
        return c && c >= d && c < next;
      }).length;
      out.push({ day: d.toLocaleDateString(undefined, { weekday: 'short' }), completed });
    }
    return out;
  }, [tasks]);

  const staffProductivity = useMemo(
    () => staffStats.filter(s => s.completed > 0).slice(0, 5).map(s => ({ name: s.name.split(' ')[0], completed: s.completed })),
    [staffStats],
  );

  const busy = loading || contextLoading;

  const kpis = [
    {
      icon: <PendingActionsOutlined />, label: 'Pending Tasks', value: metrics.pending, color: HK.warning,
      subtext: `${metrics.dirty} room${metrics.dirty === 1 ? '' : 's'} waiting`, progress: (metrics.pending / metrics.total) * 100,
    },
    {
      icon: <AutorenewOutlined />, label: 'Cleaning In Progress', value: metrics.inProgress, color: HK.info,
      subtext: `${metrics.activeStaff} staff active`, progress: (metrics.inProgress / metrics.total) * 100,
    },
    {
      icon: <CheckCircleOutlined />, label: 'Completed Today', value: metrics.completedToday, color: HK.success,
      subtext: metrics.turnaroundMin ? `~${metrics.turnaroundMin}m avg time` : `${metrics.completedAll} total done`,
      progress: metrics.completionRate, trend: metrics.trend, trendUp: metrics.trendUp,
    },
    {
      icon: <FactCheckOutlined />, label: 'Inspection Pending', value: metrics.inspection, color: HK.purple,
      subtext: 'Awaiting supervisor approval', progress: (metrics.inspection / metrics.total) * 100,
    },
    {
      icon: <HotelOutlined />, label: 'Dirty Rooms', value: metrics.dirty, color: HK.danger,
      subtext: 'Checkout rooms to clean', progress: (metrics.dirty / metrics.totalRooms) * 100,
    },
    {
      icon: <BuildOutlined />, label: 'Maintenance Issues', value: metrics.maintenance, color: HK.slate,
      subtext: 'Open maintenance requests', progress: (metrics.maintenance / metrics.total) * 100,
    },
  ];

  return (
    <PageLayout>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <HkHeader
          isDark={isDark}
          staffAvailable={staff.length}
          roomsOccupied={metrics.occupied}
          totalRooms={rooms.length}
          onCreate={(preset) => handleCreate(preset)}
          onAssignRoom={() => handleCreate()}
          onViewReports={() => navigate('/dashboard')}
        />

        {/* KPI cards */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', xl: 'repeat(6, 1fr)' },
          gap: 2,
        }}>
          {kpis.map((k, i) => (
            <HkKpiCard key={k.label} {...k} isDark={isDark} loading={busy} delay={i * 0.05} />
          ))}
        </Box>

        {/* Operational modules */}
        <Grid container spacing={2.5}>
          <Grid item xs={12} lg={8}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <RoomStatusBoard
                rooms={annotatedRooms}
                isDark={isDark}
                loading={busy}
                onRoomClick={(room) => handleCreate(null, room)}
              />
              <TasksTable
                rows={tableRows}
                isDark={isDark}
                loading={busy}
                onEdit={(r) => handleEdit(r.raw)}
                onDelete={(r) => setDeleteTarget(r._id)}
                onComplete={(r) => handleCompleteTask(r._id)}
              />
            </Box>
          </Grid>
          <Grid item xs={12} lg={4}>
            <StaffPanel staff={staffStats} isDark={isDark} loading={busy} />
          </Grid>
        </Grid>

        {/* Analytics */}
        <HkCharts
          isDark={isDark}
          loading={busy}
          completionRate={metrics.completionRate}
          turnaroundMin={metrics.turnaroundMin}
          weekly={weekly}
          staffProductivity={staffProductivity}
        />
      </Box>

      <FormDialog
        open={openDialog}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
        maxWidth="md"
        icon={selectedTask ? <EditIcon /> : <CleaningIcon />}
        eyebrow="Housekeeping"
        title={selectedTask ? 'Edit Task' : 'New Task'}
        submitLabel={selectedTask ? 'Update Task' : 'Create Task'}
      >
        <FormSection title="Task Details" icon={<CleaningIcon fontSize="small" />} iconColor="#06b6d4">
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel id="location-type-label">Location Type</InputLabel>
                <Select
                  labelId="location-type-label"
                  id="location-type"
                  name="locationType"
                  value={formData.locationType}
                  label="Location Type"
                  onChange={(e) => setFormData({ ...formData, locationType: e.target.value, roomId: '', hallId: '' })}
                  MenuProps={{ PaperProps: { sx: { backgroundColor: '#fff' } } }}
                >
                  <MenuItem value="room">Guest Room</MenuItem>
                  <MenuItem value="hall">Banquet Hall</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              {formData.locationType === 'hall' ? (
                <FormControl fullWidth required>
                  <InputLabel id="hall-select-label">Banquet Hall</InputLabel>
                  <Select
                    labelId="hall-select-label"
                    id="hall-select"
                    name="hallId"
                    value={formData.hallId}
                    label="Banquet Hall"
                    onChange={(e) => setFormData({ ...formData, hallId: e.target.value })}
                    MenuProps={{ PaperProps: { sx: { backgroundColor: '#fff' } } }}
                  >
                    {Array.isArray(halls) && halls.map((hall) => (
                      <MenuItem key={hall._id} value={hall._id}>
                        {hall.name}{hall.capacity ? ` (cap. ${hall.capacity})` : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <FormControl fullWidth required>
                  <InputLabel id="room-select-label">Room</InputLabel>
                  <Select
                    labelId="room-select-label"
                    id="room-select"
                    name="roomId"
                    value={formData.roomId}
                    label="Room"
                    onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                    MenuProps={{ PaperProps: { sx: { backgroundColor: '#fff' } } }}
                  >
                    {Array.isArray(rooms) && rooms.map((room) => (
                      <MenuItem key={room._id} value={room._id}>
                        Room {room.roomNumber} - {room.type}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel id="task-type-label">Task Type</InputLabel>
                <Select
                  labelId="task-type-label"
                  id="task-type"
                  name="taskType"
                  value={formData.taskType || ''}
                  label="Task Type"
                  onChange={(e) => setFormData({ ...formData, taskType: e.target.value })}
                  MenuProps={{ PaperProps: { sx: { backgroundColor: '#fff' } } }}
                >
                  {(TASK_TYPES.includes(formData.taskType)
                    ? TASK_TYPES
                    : [formData.taskType, ...TASK_TYPES].filter(Boolean)
                  ).map((type) => (
                    <MenuItem key={type} value={type}>{type}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                id="description"
                name="description"
                fullWidth
                label="Description"
                multiline
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel id="assigned-to-label">Assigned To</InputLabel>
                <Select
                  labelId="assigned-to-label"
                  id="assigned-to"
                  name="assignedTo"
                  value={formData.assignedTo || ''}
                  label="Assigned To"
                  onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                  MenuProps={{ PaperProps: { sx: { backgroundColor: '#fff' } } }}
                >
                  <MenuItem value=""><em>Select Staff Member</em></MenuItem>
                  {Array.isArray(staff) && staff.map((member) => (
                    <MenuItem key={member._id} value={member._id}>
                      {member.firstName && member.lastName
                        ? `${member.firstName} ${member.lastName}`
                        : member.name || member.username || 'Unknown'}
                      {member.role?.name && (
                        <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                          ({member.role.name})
                        </Typography>
                      )}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel id="priority-select-label">Priority</InputLabel>
                <Select
                  labelId="priority-select-label"
                  id="priority-select"
                  name="priority"
                  value={formData.priority}
                  label="Priority"
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  MenuProps={{ PaperProps: { sx: { backgroundColor: '#fff' } } }}
                >
                  {PRIORITY_LEVELS.map((level) => (
                    <MenuItem key={level} value={level}>{level}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel id="status-select-label">Status</InputLabel>
                <Select
                  labelId="status-select-label"
                  id="status-select"
                  name="status"
                  value={formData.status}
                  label="Status"
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  MenuProps={{ PaperProps: { sx: { backgroundColor: '#fff' } } }}
                >
                  {TASK_STATUS.map((status) => (
                    <MenuItem key={status} value={status}>{status}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <AppDateTimePicker
                label="Scheduled For"
                value={formData.scheduledFor}
                onChange={(v) => setFormData({ ...formData, scheduledFor: v })}
                slotProps={{ textField: { id: 'scheduled-for', name: 'scheduledFor', required: true } }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                id="notes"
                name="notes"
                fullWidth
                label="Notes"
                multiline
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </FormSection>
      </FormDialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
          aria-label={`${snackbar.severity} alert: ${snackbar.message}`}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        severity="error"
        title="Delete this task?"
        message="This cleaning task will be permanently removed. This action can't be undone."
        confirmLabel="Delete task"
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => !deleting && setDeleteTarget(null)}
      />
    </PageLayout>
  );
};

export default Housekeepings;
