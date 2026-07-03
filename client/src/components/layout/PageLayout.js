import { createContext, useContext } from 'react';
import { Box } from '@mui/material';
import PageTransition from './PageTransition';
import { useSettings } from '../../contexts/SettingsContext';

// Tracks whether we're already inside a PageLayout. Routes wrap pages in a
// PageLayout and several pages also render their own — without this guard that
// produced two stacked glass surfaces. A nested PageLayout renders as a no-op.
const PageLayoutContext = createContext(false);

const PageLayout = ({ children }) => {
  const isNested = useContext(PageLayoutContext);
  if (isNested) {
    return <>{children}</>;
  }
  return <PageLayoutInner>{children}</PageLayoutInner>;
};

const PageLayoutInner = ({ children }) => {
  const { settings } = useSettings();
  const isDarkMode = settings?.theme?.darkMode;
  let _backgroundPattern = '';
  if (settings?.theme?.backgroundPattern === 'dots') {
    _backgroundPattern = `radial-gradient(circle, ${settings.theme.accentColor || '#F59E42'} 1.5px, transparent 1.5px), #${isDarkMode ? '18181b' : 'f8f9fa'}`;
  } else if (settings?.theme?.backgroundPattern === 'lines') {
    _backgroundPattern = `repeating-linear-gradient(90deg, ${settings.theme.accentColor || '#F59E42'}, ${settings.theme.accentColor || '#F59E42'} 2px, transparent 2px, transparent 20px), #${isDarkMode ? '18181b' : 'f8f9fa'}`;
  } else if (settings?.theme?.backgroundPattern === 'gradient') {
    _backgroundPattern = `linear-gradient(135deg, ${settings.theme.primaryColor || 'var(--app-primary)'} 0%, ${settings.theme.secondaryColor || '#EC4899'} 100%)`;
  } else {
    _backgroundPattern = isDarkMode ? '#18181b' : '#f8f9fa';
  }
  return (
    <PageLayoutContext.Provider value={true}>
      <PageTransition>
        <Box sx={{
          minHeight: '100vh',
          py: { xs: 2, md: 3 },
          px: { xs: 1.5, md: 3 },
          width: '100%',
          fontFamily: settings?.theme?.fontFamily,
          fontSize: settings?.theme?.fontSize,
          color: isDarkMode ? '#f3f4f6' : '#23272f',
          transition: 'background 0.3s, color 0.3s',
        }}>
          {/* Shared glassmorphism surface for every routed page. The fixed
              /images/background.jpg on the body shows through the blur. */}
          <Box sx={{
            minHeight: 'calc(100vh - 48px)',
            borderRadius: 4,
            p: { xs: 2, md: 3.5 },
            background: isDarkMode ? 'rgba(35,39,47,0.55)' : 'rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))',
            backdropFilter: 'var(--app-blur-strong)',
            WebkitBackdropFilter: 'var(--app-blur-strong)',
            border: isDarkMode ? '1.5px solid rgba(148,163,184,0.14)' : '1.5px solid rgba(255,255,255,0.18)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
          }}>
            {children}
          </Box>
        </Box>
      </PageTransition>
    </PageLayoutContext.Provider>
  );
};

export default PageLayout;