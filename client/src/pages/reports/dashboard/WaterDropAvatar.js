import { Box } from '@mui/material';

// Circular gradient avatar (the user-menu chip in the dashboard header).
function WaterDropAvatar({ letter, size = 40, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        cursor: 'pointer',
        background: 'linear-gradient(135deg, rgba(20,20,25,0.95) 0%, rgba(40,40,50,0.85) 50%, rgba(15,15,20,0.98) 100%)',
        borderRadius: '50%',
        backdropFilter: 'var(--app-blur)',
        fontSize: size * 0.48,
        fontWeight: 700,
        color: '#ffffff',
        userSelect: 'none',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'scale(1.1)',
          background: 'linear-gradient(135deg, rgba(15,15,20,0.98) 0%, rgba(30,30,40,0.9) 50%, rgba(10,10,15,1) 100%)',
        },
      }}
    >
      {letter}
    </Box>
  );
}

export default WaterDropAvatar;
