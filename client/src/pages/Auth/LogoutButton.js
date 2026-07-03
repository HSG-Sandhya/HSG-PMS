import { Button, IconButton, Tooltip } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../../contexts/AuthContext';

const LogoutButton = ({ variant = 'icon', color = 'inherit', size = 'medium', tooltip = 'Logout' }) => {
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  if (variant === 'icon') {
    return (
      <Tooltip title={tooltip}>
        <IconButton
          color={color}
          onClick={handleLogout}
          size={size}
          aria-label="logout"
        >
          <LogoutIcon />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <Button
      variant={variant}
      color={color}
      onClick={handleLogout}
      startIcon={<LogoutIcon />}
      size={size}
    >
      Logout
    </Button>
  );
};

export default LogoutButton;