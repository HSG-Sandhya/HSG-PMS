import { useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PeopleIcon from '@mui/icons-material/People';
import HistoryIcon from '@mui/icons-material/History';
import SecurityIcon from '@mui/icons-material/Security';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import RolesSection from './RolesSection';
import BackupSection from './BackupSection';
import UsersManager from './security/UsersManager';
import ActivityLogsView from './security/ActivityLogsView';
import AuditTrailView from './security/AuditTrailView';

const TABS = [
  { label: 'Role-Based Access', icon: <AdminPanelSettingsIcon sx={{ fontSize: 18 }} /> },
  { label: 'User Permissions', icon: <PeopleIcon sx={{ fontSize: 18 }} /> },
  { label: 'Activity Logs', icon: <HistoryIcon sx={{ fontSize: 18 }} /> },
  { label: 'Audit Trail', icon: <SecurityIcon sx={{ fontSize: 18 }} /> },
  { label: 'Data Backup', icon: <CloudUploadIcon sx={{ fontSize: 18 }} /> },
];

// User & Security Management — unifies role-based access, per-user permissions,
// activity logs, the audit trail and data backup into one settings tab.
const UserSecuritySection = ({ onNotify }) => {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Box sx={{
        mb: 3, p: 0.75, borderRadius: 3,
        background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
        border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
      }}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ minHeight: 0, '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 44 } }}>
          {TABS.map((t) => <Tab key={t.label} icon={t.icon} iconPosition="start" label={t.label} />)}
        </Tabs>
      </Box>

      {tab === 0 && <RolesSection onNotify={onNotify} />}
      {tab === 1 && <UsersManager onNotify={onNotify} />}
      {tab === 2 && <ActivityLogsView onNotify={onNotify} />}
      {tab === 3 && <AuditTrailView onNotify={onNotify} />}
      {tab === 4 && <BackupSection onNotify={onNotify} />}
    </Box>
  );
};

export default UserSecuritySection;
