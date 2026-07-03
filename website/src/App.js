import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Rooms from './pages/Rooms';
import Booking from './pages/Booking';
import About from './pages/About';
import Contact from './pages/Contact';
import Restaurant from './pages/Restaurant';
import RoomService from './pages/RoomService';
import Banquet from './pages/Banquet';
import Refund from './pages/legal/Refund';
import Privacy from './pages/legal/Privacy';
import Terms from './pages/legal/Terms';
import NotFound from './pages/NotFound';
import ScrollToTop from './components/ScrollToTop';
import { ScrollProgress, CinemaTransition, NoiseOverlay } from './lib/motion';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Handle browser extension related errors
    if (error.message && error.message.includes('message channel closed')) {
      console.warn('Browser extension error caught by boundary:', error.message);
      return { hasError: false }; // Don't show error UI for these
    }
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log errors but don't show error UI for browser extension issues
    if (error.message && error.message.includes('message channel closed')) {
      console.warn('Browser extension error:', error.message);
      return;
    }
    console.error('App error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '40px',
          backgroundColor: '#FAF7F0',
          color: '#1A1A1A',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          <p style={{ fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#7A7670', marginBottom: '24px' }}>
            — Something interrupted
          </p>
          <h1 style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 300, fontSize: 'clamp(2rem, 5vw, 3.5rem)', lineHeight: 1.05, textAlign: 'center', maxWidth: '40rem', margin: 0 }}>
            We’re sorry — please refresh the page.
          </h1>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '40px',
              padding: '16px 28px',
              backgroundColor: '#1A1A1A',
              color: '#FAF7F0',
              border: 'none',
              fontSize: '12px',
              fontWeight: 500,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Refresh page →
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <CinemaTransition key={location.pathname} pathKey={location.pathname}>
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/booking" element={<Booking />} />
          <Route path="/bookings" element={<Navigate to="/booking" replace />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/restaurant" element={<Restaurant />} />
          <Route path="/banquet" element={<Banquet />} />
          <Route path="/room-service/:roomNumber" element={<RoomService />} />
          <Route path="/refund-policy" element={<Refund />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          {/* Catch-all route for unmatched paths */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </CinemaTransition>
    </AnimatePresence>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <div className="App">
        <NoiseOverlay opacity={0.035} />
        <ScrollProgress />
        <ScrollToTop />
        <Navbar />
        <main>
          <AnimatedRoutes />
        </main>
        <Footer />
      </div>
    </ErrorBoundary>
  );
}

export default App; 