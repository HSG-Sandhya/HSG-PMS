import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from '../api';
import { useAuth } from './AuthContext';

// Create the context
export const HousekeepingContext = createContext();

export const HousekeepingProvider = ({ children }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subscribers, setSubscribers] = useState([]);
  const { isAuthenticated } = useAuth();

  const fetchHousekeepingTasks = async () => {
    // Housekeeping is an authenticated endpoint — don't poll it while logged
    // out (e.g. on the login page), or it floods the console with 401s.
    if (!localStorage.getItem('token')) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      // Use the getAll method directly
      const response = await api.housekeeping.getAll();

      // Server wraps the list as { success, data, message }
      const list = response.data?.data || response.data || [];
      setTasks(Array.isArray(list) ? list : []);
      setError(null);
    } catch (error) {
      console.error('Error fetching housekeeping tasks:', error);
      setError('Failed to load housekeeping tasks. Please try again later.');
      // Provide mock data in case of error
      setTasks([
        {
          _id: 1,
          roomId: 'mock-room-1',
          roomNumber: '101',
          status: 'Pending',
          taskType: 'Regular Cleaning',
          priority: 'Medium',
          assignedTo: 'John Doe',
          createdAt: new Date().toISOString(),
          scheduledFor: new Date(Date.now() + 86400000).toISOString(),
        },
        {
          _id: 2,
          roomId: 'mock-room-2',
          roomNumber: '102',
          status: 'Completed',
          taskType: 'Maintenance',
          priority: 'Medium',
          assignedTo: 'Jane Smith',
          createdAt: new Date().toISOString(),
          scheduledFor: new Date(Date.now() + 86400000).toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Add a task - wrap in useCallback
  const addTask = useCallback(async (taskData) => {
    try {
      setLoading(true);
      // Use the create method directly
      const response = await api.housekeeping.create(taskData);

      // Server wraps the created task as { success, data, message }
      const created = response.data?.data || response.data;
      setTasks(prevTasks => [...(Array.isArray(prevTasks) ? prevTasks : []), created]);
      return { success: true, data: created };
    } catch (error) {
      console.error('Error adding housekeeping task:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Update a task - also wrap in useCallback
  const updateTask = useCallback(async (taskId, taskData) => {
    try {
      setLoading(true);
      // Use the update method directly
      const response = await api.housekeeping.update(taskId, taskData);
      
      setTasks(prevTasks => 
        (Array.isArray(prevTasks) ? prevTasks : []).map(task => (task._id === taskId || task.id === taskId) ? response.data : task),
      );
      
      // Notify subscribers when a task is completed
      if (taskData.status === 'Completed') {
        const task = (Array.isArray(tasks) ? tasks : []).find(t => t._id === taskId || t.id === taskId) || response.data;
        subscribers.forEach(callback => {
          try {
            callback({
              type: task.taskType || 'maintenance',
              roomId: task.roomId,
              status: 'completed',
              timestamp: new Date().toISOString(),
            });
          } catch (err) {
            console.error('Error in housekeeping completion subscriber:', err);
          }
        });
      }
      
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error updating housekeeping task:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [tasks, subscribers]);

  // Delete a task - also wrap in useCallback
  const deleteTask = useCallback(async (taskId) => {
    try {
      setLoading(true);
      // Use the delete method directly
      await api.housekeeping.delete(taskId);
      
      setTasks(prevTasks => (Array.isArray(prevTasks) ? prevTasks : []).filter(task => (task._id !== taskId && task.id !== taskId)));
      return { success: true };
    } catch (error) {
      console.error('Error deleting housekeeping task:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Complete a task - wrap in useCallback
  const completeTask = useCallback(async (taskId) => {
    try {
      setLoading(true);
      
      // Find the task first to get its details - handle both wrapped and unwrapped structures
      const task = (Array.isArray(tasks) ? tasks : []).find(t => {
        const actualTask = t.data ? t.data : t;
        return actualTask._id === taskId || actualTask.id === taskId;
      });
      if (!task) {
        throw new Error('Task not found');
      }
      
      // Use the update method instead of completeTask
      const response = await api.housekeeping.update(taskId, {
        status: 'Completed',
        completedAt: new Date().toISOString()
      });
      
      // Update local state - handle both wrapped and unwrapped structures
      setTasks(prevTasks => 
        (Array.isArray(prevTasks) ? prevTasks : []).map(t => {
          const actualTask = t.data ? t.data : t;
          if (actualTask._id === taskId || actualTask.id === taskId) {
            return t.data ? { ...t, data: { ...t.data, status: 'Completed' } } : { ...t, status: 'Completed' };
          }
          return t;
        }),
      );
      
      // Notify subscribers about task completion
      const actualTask = task.data ? task.data : task;
      subscribers.forEach(callback => {
        try {
          callback({
            type: actualTask.taskType || 'maintenance',
            roomId: actualTask.roomId,
            status: 'completed',
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          console.error('Error in housekeeping completion subscriber:', err);
        }
      });
      
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error completing housekeeping task:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [tasks, subscribers]);

  // Add notifyHousekeeping function with useCallback
  const notifyHousekeeping = useCallback(async (notification) => {
    try {
      // If notification already has taskType, it's a complete task data object
      if (notification.taskType) {
        // Add the notification as a new task with all the provided data
        const result = await addTask({
          roomId: notification.roomId,
          taskType: notification.taskType,
          description: notification.description || '',
          assignedTo: notification.assignedTo || '',
          priority: notification.priority || 'Medium',
          status: notification.status || 'Pending',
          notes: notification.notes || '',
          scheduledFor: notification.scheduledFor || new Date().toISOString(),
          source: notification.source || 'room_notification',
          notificationData: notification.notificationData || null,
        });
        return result;
      } else {
        // Legacy format - convert to new format
        const result = await addTask({
          roomId: notification.roomId,
          taskType: notification.type === 'maintenance' ? 'Maintenance' : 'Regular Cleaning',
          description: `${notification.type === 'maintenance' ? 'Maintenance' : 'Cleaning'} required for Room ${notification.roomNumber}.`,
          priority: notification.type === 'maintenance' ? 'High' : 'Medium',
          status: 'Pending',
          scheduledFor: notification.timestamp || new Date().toISOString(),
          source: 'room_notification',
          notificationData: {
            roomNumber: notification.roomNumber,
            timestamp: notification.timestamp || new Date().toISOString(),
          },
        });
        return result;
      }
    } catch (error) {
      console.error('Error in notifyHousekeeping:', error);
      return { success: false, error: error.message || 'Failed to create housekeeping task' };
    }
  }, [addTask]);

  // Add subscribeToCompletionEvents function
  const subscribeToCompletionEvents = useCallback((callback) => {
    if (typeof callback !== 'function') {
      console.error('subscribeToCompletionEvents requires a function callback');
      return () => {}; // Return empty unsubscribe function
    }
    
    setSubscribers(prev => [...prev, callback]);
    
    // Return unsubscribe function
    return () => {
      setSubscribers(prev => prev.filter(cb => cb !== callback));
    };
  }, []);

  useEffect(() => {
    // Only fetch/poll once the user is authenticated. This also re-triggers the
    // initial load right after login, and stops polling on logout.
    if (!isAuthenticated) {
      setTasks([]);
      setLoading(false);
      return undefined;
    }

    fetchHousekeepingTasks();

    // Set up auto-refresh every 5 minutes
    const refreshInterval = setInterval(fetchHousekeepingTasks, 5 * 60 * 1000);

    // Clean up interval on component unmount
    return () => {
      clearInterval(refreshInterval);
    };
  }, [isAuthenticated]);

  return (
    <HousekeepingContext.Provider value={{ 
      tasks, 
      loading, 
      error, 
      addTask, 
      updateTask, 
      deleteTask, 
      completeTask,
      refreshTasks: fetchHousekeepingTasks,
      notifyHousekeeping,
      subscribeToCompletionEvents,
    }}>
      {children}
    </HousekeepingContext.Provider>
  );
};

export const useHousekeeping = () => useContext(HousekeepingContext);