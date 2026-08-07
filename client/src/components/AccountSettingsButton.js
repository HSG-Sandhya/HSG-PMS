// Self-service "My Account" control for the logged-in user. Renders its own
// trigger (an icon button for compact bars, or a styled sidebar row) plus the
// dialog, so a parent only has to drop <AccountSettingsButton /> anywhere.
//
// Staff set a username and password of their own choosing after the admin hands
// them an auto-generated pair. Both changes are gated on the current password —
// the username IS the login identifier, so handing it over is as good as handing
// over the account. Either field can be left alone: only what changed is sent.

import { useEffect, useState } from 'react';
import {
  Box, IconButton, Tooltip, TextField, InputAdornment, Alert, Stack, Divider,
} from '@mui/material';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import LockResetIcon from '@mui/icons-material/LockReset';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import FormDialog, { FormSection } from './forms/FormDialog';
import { useAuth } from '../contexts/AuthContext';
import { renameRemembered, forgetRememberedPassword } from '../utils/rememberedLogin';
import api from '../api';

const EMPTY = { username: '', currentPassword: '', newPassword: '', confirmPassword: '' };

const AccountSettingsButton = ({ variant = 'icon', isDarkMode = false }) => {
  const { user, setUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Open with the current username in the field, so it reads as "this is you"
  // and an untouched field means "leave it alone".
  useEffect(() => {
    if (open) setForm({ ...EMPTY, username: user?.username || '' });
  }, [open, user?.username]);

  const close = () => {
    setOpen(false);
    setForm(EMPTY);
    setShow({ current: false, next: false, confirm: false });
    setError('');
    setSuccess('');
    setSubmitting(false);
  };

  const setField = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setError(''); };
  const toggle = (k) => () => setShow((s) => ({ ...s, [k]: !s[k] }));

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setError('');

    const nextUsername = form.username.trim();
    const usernameChanged = !!nextUsername && nextUsername !== (user?.username || '');
    const wantsPasswordChange = !!(form.newPassword || form.confirmPassword);

    if (!usernameChanged && !wantsPasswordChange) {
      setError('Change your username or your password, then save.');
      return;
    }
    if (!form.currentPassword) {
      setError('Enter your current password to confirm the change.');
      return;
    }
    if (usernameChanged && !/^[a-zA-Z0-9._-]{3,30}$/.test(nextUsername)) {
      setError('Username must be 3-30 characters — letters, numbers, dot, underscore or hyphen only.');
      return;
    }
    if (wantsPasswordChange) {
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
    }

    setSubmitting(true);
    const previousUsername = user?.username || '';
    try {
      // Username first: the password change would invalidate `currentPassword`
      // for anything that ran after it.
      if (usernameChanged) {
        const res = await api.auth.changeOwnUsername({
          currentPassword: form.currentPassword,
          newUsername: nextUsername,
        });
        // Keep the cached user in step — the JWT still carries the old username
        // until the next sign-in, but nothing authorises on it.
        const saved = res?.data?.username || nextUsername;
        const updated = { ...(user || {}), username: saved };
        setUser?.(updated);
        try { localStorage.setItem('user', JSON.stringify(updated)); } catch { /* ignore */ }
      }
      if (wantsPasswordChange) {
        await api.auth.changeOwnPassword({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        });
      }

      // Keep any "Remember me" entry on this device honest. A rename just moves
      // it across; a new password cannot be re-encrypted here (that needs the
      // PIN, which is deliberately never held), so the saved copy is dropped
      // rather than left to fail at the next sign-in.
      if (usernameChanged) renameRemembered(previousUsername, nextUsername);
      const droppedSaved = wantsPasswordChange && forgetRememberedPassword();

      setSuccess(
        (usernameChanged && wantsPasswordChange ? 'Username and password updated.'
          : usernameChanged ? 'Username updated. Use it the next time you sign in.'
            : 'Password changed successfully.')
        + (droppedSaved ? ' The password saved on this device was cleared — tick Remember me at the next sign-in to save the new one.' : ''),
      );
      setTimeout(close, 1400);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not save your changes. Please try again.');
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
            // Match the Settings/Logout rows: carry a resting glass shadow and
            // swap to an elevated one on hover so the row lifts *with* depth,
            // instead of fading into the background with no shape.
            boxShadow: isDarkMode
              ? '0 6px 16px -4px rgba(0,0,0,0.2), 0 3px 8px -2px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-alpha, 0.05))'
              : '0 6px 16px -4px rgba(0,0,0,0.1), 0 3px 8px -2px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.6)',
            backdropFilter: 'var(--app-blur)',
            WebkitBackdropFilter: 'var(--app-blur)',
            '&:hover': {
              transform: 'translateY(-2px)',
              background: isDarkMode ? 'rgba(var(--app-primary-rgb),0.15)' : 'rgba(var(--app-primary-rgb),0.08)',
              boxShadow: isDarkMode
                ? '0 10px 24px -4px rgba(0,0,0,0.25), 0 5px 12px -2px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))'
                : '0 10px 24px -4px rgba(0,0,0,0.15), 0 5px 12px -2px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
            },
          }}
        >
          <ManageAccountsIcon />
          <span>My Account</span>
        </Box>
      ) : (
        <Tooltip title="Username & password">
          <IconButton color="inherit" onClick={() => setOpen(true)} aria-label="account settings">
            <ManageAccountsIcon />
          </IconButton>
        </Tooltip>
      )}
      <FormDialog
        open={open}
        onClose={close}
        onSubmit={handleSubmit}
        icon={<ManageAccountsIcon />}
        eyebrow="Account Security"
        title="My Account"
        submitLabel={submitting ? 'Saving…' : 'Save changes'}
        submitDisabled={submitting || !!success}
        maxWidth="xs"
        formId="account-settings-form"
      >
        <FormSection title="Sign-in details" icon={<PersonOutlineIcon />} iconColor="#6366f1">
          <Stack spacing={2}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            {success ? <Alert severity="success">{success}</Alert> : null}
            <TextField
              fullWidth
              label="Username"
              value={form.username}
              onChange={setField('username')}
              autoComplete="username"
              helperText="This is what you type to sign in."
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonOutlineIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              fullWidth
              type={show.current ? 'text' : 'password'}
              label="Current password"
              value={form.currentPassword}
              onChange={setField('currentPassword')}
              autoComplete="current-password"
              helperText="Required to confirm any change."
              slotProps={{
                input: { endAdornment: adornment('current') }
              }}
            />
          </Stack>
        </FormSection>

        <Divider sx={{ my: 1 }} />

        <FormSection title="New password (optional)" icon={<LockResetIcon />} iconColor="#0ea5e9">
          <Stack spacing={2}>
            <TextField
              fullWidth
              type={show.next ? 'text' : 'password'}
              label="New password"
              value={form.newPassword}
              onChange={setField('newPassword')}
              autoComplete="new-password"
              helperText="At least 6 characters. Leave blank to keep your current password."
              slotProps={{
                input: { endAdornment: adornment('next') }
              }}
            />
            <TextField
              fullWidth
              type={show.confirm ? 'text' : 'password'}
              label="Confirm new password"
              value={form.confirmPassword}
              onChange={setField('confirmPassword')}
              autoComplete="new-password"
              slotProps={{
                input: { endAdornment: adornment('confirm') }
              }}
            />
          </Stack>
        </FormSection>
      </FormDialog>
    </>
  );
};

export default AccountSettingsButton;
