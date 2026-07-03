// Self-service "Change Password" control for the logged-in user. Renders its own
// trigger (an icon button for compact bars, or a styled sidebar row) plus the
// dialog, so a parent only has to drop <ChangePasswordButton /> anywhere.
//
// Staff set a password of their own choosing after the admin hands them an
// auto-generated one. Requires the current password; the new one is verified
// client-side (match + length) and server-side.

import { useState } from 'react';
import {
  Box, IconButton, Tooltip, TextField, InputAdornment, Alert, Stack,
} from '@mui/material';
import LockResetIcon from '@mui/icons-material/LockReset';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import FormDialog, { FormSection } from './forms/FormDialog';
import api from '../api';

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' };

const ChangePasswordButton = ({ variant = 'icon', isDarkMode = false }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setForm(EMPTY);
    setShow({ current: false, next: false, confirm: false });
    setError('');
    setSuccess('');
    setSubmitting(false);
  };

  const close = () => { setOpen(false); reset(); };

  const setField = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setError(''); };
  const toggle = (k) => () => setShow((s) => ({ ...s, [k]: !s[k] }));

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setError('');

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (form.newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (form.newPassword === form.currentPassword) {
      setError('New password must be different from the current one.');
      return;
    }

    setSubmitting(true);
    try {
      await api.auth.changeOwnPassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setSuccess('Password changed successfully.');
      setTimeout(close, 1200);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not change password. Please try again.');
      setSubmitting(false);
    }
  };

  const adornment = (key) => (
    <InputAdornment position="end">
      <IconButton size="small" onClick={toggle(key)} edge="end" tabIndex={-1}>
        {show[key] ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
      </IconButton>
    </InputAdornment>
  );

  return (
    <>
      {variant === 'row' ? (
        <Box
          role="button"
          tabIndex={0}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen(true)}
          sx={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '16px 20px',
            borderRadius: '18px',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
            color: isDarkMode ? '#e2e8f0' : '#475569',
            background: isDarkMode ? 'rgba(30,41,59,0.3)' : 'rgba(255,255,255,0.4)',
            border: isDarkMode ? '1px solid rgba(148,163,184,0.15)' : '1px solid rgba(203,213,225,0.25)',
            backdropFilter: 'var(--app-blur)',
            WebkitBackdropFilter: 'var(--app-blur)',
            '&:hover': {
              transform: 'translateY(-2px)',
              background: isDarkMode ? 'rgba(var(--app-primary-rgb),0.15)' : 'rgba(var(--app-primary-rgb),0.08)',
            },
          }}
        >
          <LockResetIcon />
          <span>Change Password</span>
        </Box>
      ) : (
        <Tooltip title="Change password">
          <IconButton color="inherit" onClick={() => setOpen(true)} aria-label="change password">
            <LockResetIcon />
          </IconButton>
        </Tooltip>
      )}

      <FormDialog
        open={open}
        onClose={close}
        onSubmit={handleSubmit}
        icon={<LockResetIcon />}
        eyebrow="Account Security"
        title="Change Password"
        submitLabel={submitting ? 'Saving…' : 'Update password'}
        submitDisabled={submitting || !!success}
        maxWidth="xs"
        formId="change-password-form"
      >
        <FormSection title="Set a new password" icon={<LockResetIcon />} iconColor="#0ea5e9">
          <Stack spacing={2}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            {success ? <Alert severity="success">{success}</Alert> : null}
            <TextField
              fullWidth
              type={show.current ? 'text' : 'password'}
              label="Current password"
              value={form.currentPassword}
              onChange={setField('currentPassword')}
              autoComplete="current-password"
              InputProps={{ endAdornment: adornment('current') }}
            />
            <TextField
              fullWidth
              type={show.next ? 'text' : 'password'}
              label="New password"
              value={form.newPassword}
              onChange={setField('newPassword')}
              autoComplete="new-password"
              helperText="At least 6 characters."
              InputProps={{ endAdornment: adornment('next') }}
            />
            <TextField
              fullWidth
              type={show.confirm ? 'text' : 'password'}
              label="Confirm new password"
              value={form.confirmPassword}
              onChange={setField('confirmPassword')}
              autoComplete="new-password"
              InputProps={{ endAdornment: adornment('confirm') }}
            />
          </Stack>
        </FormSection>
      </FormDialog>
    </>
  );
};

export default ChangePasswordButton;
