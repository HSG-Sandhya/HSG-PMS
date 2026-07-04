// Aadhaar front + back capture with on-device OCR (Tesseract.js, lazy-loaded).
// After a scan, extracted fields are shown in a REVIEW panel — the clerk edits /
// deselects anything wrong, then applies it to the booking form. Nothing is
// auto-overwritten without confirmation. There is no UIDAI lookup; all data is
// read off the uploaded card images.
import { useState, useEffect, useMemo } from 'react';
import {
  Box, Grid, Stack, Typography, Button, IconButton, TextField, Checkbox,
  Chip, LinearProgress, FormControlLabel,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import DocumentScannerIcon from '@mui/icons-material/DocumentScanner';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';

// ── OCR text → structured Aadhaar fields (best-effort heuristics) ────────────
const isNameLine = (l) =>
  /^[A-Za-z][A-Za-z .]{2,}$/.test(l) &&
  !/GOVERNMENT|INDIA|MALE|FEMALE|DOB|YEAR|UNIQUE|IDENTIFICATION|AUTHORITY|AADHAAR|ENROL/i.test(l);

const ageFromDob = (dob) => {
  const m = String(dob).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return '';
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const md = now.getMonth() - d.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < d.getDate())) age -= 1;
  return age > 0 && age < 130 ? String(age) : '';
};

const parseAadhaar = (frontText, backText) => {
  const all = `${frontText}\n${backText}`;
  const out = {};

  const num = all.match(/\b(\d{4})\s*(\d{4})\s*(\d{4})\b/);
  if (num) out.aadhaar = `${num[1]}-${num[2]}-${num[3]}`;

  if (/\bFEMALE\b|महिला/i.test(all)) out.gender = 'Female';
  else if (/\bMALE\b|पुरुष/i.test(all)) out.gender = 'Male';
  else if (/TRANSGENDER/i.test(all)) out.gender = 'Other';

  const dob = all.match(/(?:DOB|Date of Birth|D\.?O\.?B)\D{0,6}(\d{2}[/.-]\d{2}[/.-]\d{4})/i)
    || all.match(/\b(\d{2}[/.-]\d{2}[/.-]\d{4})\b/);
  if (dob) out.dob = dob[1].replace(/[.-]/g, '/');
  else {
    const yob = all.match(/Year of Birth\D{0,4}(\d{4})/i);
    if (yob) out.dob = `01/01/${yob[1]}`;
  }

  const lines = frontText.split('\n').map((l) => l.trim()).filter(Boolean);
  const dobIdx = lines.findIndex((l) => /\d{2}[/.-]\d{2}[/.-]\d{4}|Year of Birth|DOB/i.test(l));
  let name = '';
  if (dobIdx > 0) {
    for (let i = dobIdx - 1; i >= 0 && !name; i--) if (isNameLine(lines[i])) name = lines[i];
  }
  if (!name) name = lines.find(isNameLine) || '';
  if (name) out.name = name.replace(/\s+/g, ' ').trim();

  const pin = backText.match(/\b(\d{6})\b/);
  if (pin) out.pincode = pin[1];

  let addr = backText;
  const aIdx = backText.search(/Address\s*[:-]/i);
  if (aIdx >= 0) addr = backText.slice(aIdx).replace(/Address\s*[:-]/i, '');
  addr = addr.replace(/\n+/g, ', ').replace(/[ \t]+/g, ' ').replace(/(,\s*)+/g, ', ').trim();
  if (addr.length > 4) out.address = addr;

  return out;
};

const REVIEW_ROWS = [
  { key: 'name', label: 'Name' },
  { key: 'dob', label: 'Date of birth' },
  { key: 'gender', label: 'Gender' },
  { key: 'aadhaar', label: 'Aadhaar number' },
  { key: 'address', label: 'Address' },
  { key: 'pincode', label: 'Pincode' },
];

// ── Single drop tile ─────────────────────────────────────────────────────────
const DropTile = ({ label, file, onPick, onClear }) => {
  const url = useMemo(() => (file instanceof File ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  return (
    <Box
      component="label"
      sx={{
        display: 'block', cursor: 'pointer', position: 'relative',
        borderRadius: 2.5, overflow: 'hidden',
        border: '1.5px dashed', borderColor: file ? 'var(--app-primary)' : 'divider',
        background: file ? 'transparent' : 'rgba(var(--app-primary-rgb),0.03)',
        minHeight: 132, transition: 'all 0.18s ease',
        '&:hover': { borderColor: 'var(--app-primary)', background: 'rgba(var(--app-primary-rgb),0.05)' },
      }}
    >
      {url ? (
        <>
          <Box component="img" src={url} alt={label}
            sx={{ width: '100%', height: 132, objectFit: 'cover', display: 'block' }} />
          <IconButton size="small"
            onClick={(e) => { e.preventDefault(); onClear(); }}
            sx={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.55)', color: '#fff',
              '&:hover': { background: 'rgba(0,0,0,0.75)' } }}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
          <Chip size="small" label={label} sx={{ position: 'absolute', bottom: 6, left: 6, fontWeight: 700,
            background: 'rgba(0,0,0,0.6)', color: '#fff' }} />
        </>
      ) : (
        <Stack
          spacing={0.5}
          sx={{
            alignItems: "center",
            justifyContent: "center",
            height: 132,
            color: 'text.secondary'
          }}>
          <CloudUploadIcon sx={{ color: 'var(--app-primary)' }} />
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{label}</Typography>
          <Typography variant="caption">JPG / PNG</Typography>
        </Stack>
      )}
      <input type="file" hidden accept="image/*"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }} />
    </Box>
  );
};

const AadhaarCapture = ({ frontFile, backFile, onFront, onBack, onApply, validateAadhaar }) => {
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState('');
  const [ocrError, setOcrError] = useState('');
  const [review, setReview] = useState(null);
  const [include, setInclude] = useState(() => new Set());

  const runScan = async () => {
    if (!frontFile && !backFile) return;
    setScanning(true); setOcrError(''); setStatus('Loading scanner…');
    try {
      const mod = await import('tesseract.js');
      const recognize = mod.recognize || mod.default?.recognize;
      const read = async (file, which) => {
        if (!file) return '';
        setStatus(`Reading ${which}…`);
        const { data } = await recognize(file, 'eng');
        return data?.text || '';
      };
      const frontText = await read(frontFile, 'front');
      const backText = await read(backFile, 'back');
      const parsed = parseAadhaar(frontText, backText);
      if (!Object.keys(parsed).length) {
        setOcrError('Could not read any details from the image(s). Enter them manually.');
        setReview(null);
      } else {
        setReview(parsed);
        setInclude(new Set(Object.keys(parsed).filter((k) => parsed[k])));
      }
    } catch (e) {
      setOcrError('Scan failed. Check your connection (the OCR model loads on first use) or enter details manually.');
    } finally {
      setScanning(false); setStatus('');
    }
  };

  // Clear the review if both images are removed.
  useEffect(() => { if (!frontFile && !backFile) { setReview(null); setOcrError(''); } }, [frontFile, backFile]);

  const setField = (key, val) => setReview((r) => ({ ...r, [key]: val }));
  const toggle = (key) => setInclude((s) => {
    const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n;
  });

  const apply = () => {
    const f = {};
    if (include.has('name') && review.name) f.guestName = review.name;
    if (include.has('gender') && review.gender) f.gender = review.gender;
    if (include.has('dob') && review.dob) { const a = ageFromDob(review.dob); if (a) f.age = a; }
    if (include.has('aadhaar') && review.aadhaar) f.idCardNumber = review.aadhaar;
    if (include.has('address') && review.address) f.streetName = review.address;
    if (include.has('pincode') && review.pincode) f.pincode = review.pincode;
    onApply(f, include.has('aadhaar') ? review.aadhaar : undefined);
  };

  const aadhaarValid = review?.aadhaar ? validateAadhaar(review.aadhaar) : null;

  return (
    <Box sx={{ mt: 1 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: "center",
          mb: 1.5
        }}>
        <DocumentScannerIcon fontSize="small" sx={{ color: 'var(--app-primary)' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Aadhaar card images</Typography>
        <Typography variant="caption" sx={{
          color: "text.secondary"
        }}>— upload front &amp; back, then scan to auto-fill</Typography>
      </Stack>
      <Grid container spacing={2}>
        <Grid
          size={{
            xs: 12,
            sm: 6
          }}>
          <DropTile label="Front" file={frontFile} onPick={onFront} onClear={() => onFront(null)} />
        </Grid>
        <Grid
          size={{
            xs: 12,
            sm: 6
          }}>
          <DropTile label="Back (address)" file={backFile} onPick={onBack} onClear={() => onBack(null)} />
        </Grid>
      </Grid>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          alignItems: "center",
          mt: 1.5
        }}>
        <Button
          onClick={runScan} disabled={(!frontFile && !backFile) || scanning}
          variant="contained" startIcon={<AutoFixHighIcon />}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2,
            background: 'var(--app-primary)', '&:hover': { background: 'var(--app-primary)', filter: 'brightness(1.05)' } }}
        >
          {scanning ? 'Scanning…' : 'Scan & autofill'}
        </Button>
        {scanning && <Typography variant="caption" sx={{
          color: "text.secondary"
        }}>{status}</Typography>}
      </Stack>
      {scanning && <LinearProgress sx={{ mt: 1.5, borderRadius: 1 }} />}
      {ocrError && (
        <Stack
          direction="row"
          spacing={0.75}
          sx={{
            alignItems: "center",
            mt: 1.5,
            color: 'warning.main'
          }}>
          <ErrorOutlineIcon fontSize="small" />
          <Typography variant="body2">{ocrError}</Typography>
        </Stack>
      )}
      {review && (
        <Box sx={{ mt: 2, p: 2, borderRadius: 2.5, border: '1px solid', borderColor: 'divider',
          background: 'rgba(var(--app-primary-rgb),0.03)' }}>
          <Stack
            direction="row"
            sx={{
              justifyContent: "space-between",
              alignItems: "center",
              mb: 1.5
            }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Review extracted details</Typography>
            {aadhaarValid != null && (
              <Chip size="small"
                icon={aadhaarValid ? <CheckCircleIcon /> : <ErrorOutlineIcon />}
                label={aadhaarValid ? 'Aadhaar valid' : 'Aadhaar checksum invalid'}
                sx={{ fontWeight: 700,
                  color: aadhaarValid ? '#16a34a' : '#dc2626',
                  background: aadhaarValid ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }} />
            )}
          </Stack>

          <Stack spacing={1}>
            {REVIEW_ROWS.filter((row) => review[row.key] != null).map((row) => (
              <Stack key={row.key} direction="row" spacing={1} sx={{
                alignItems: "center"
              }}>
                <Checkbox size="small" checked={include.has(row.key)} onChange={() => toggle(row.key)} sx={{ p: 0.5 }} />
                <TextField
                  size="small" fullWidth label={row.label}
                  value={review[row.key] || ''} onChange={(e) => setField(row.key, e.target.value)}
                  multiline={row.key === 'address'}
                  helperText={row.key === 'dob' && review.dob ? `≈ ${ageFromDob(review.dob) || '?'} yrs` : undefined}
                />
              </Stack>
            ))}
          </Stack>

          <Stack
            direction="row"
            spacing={1}
            sx={{
              justifyContent: "flex-end",
              mt: 2
            }}>
            <FormControlLabel
              sx={{ mr: 'auto' }}
              control={<Checkbox size="small"
                checked={REVIEW_ROWS.every((r) => review[r.key] == null || include.has(r.key))}
                onChange={(e) => setInclude(e.target.checked
                  ? new Set(Object.keys(review).filter((k) => review[k]))
                  : new Set())} />}
              label={<Typography variant="caption">Select all</Typography>}
            />
            <Button onClick={apply} disabled={include.size === 0} variant="contained"
              sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2,
                background: 'var(--app-primary)', '&:hover': { background: 'var(--app-primary)', filter: 'brightness(1.05)' } }}>
              Apply to form
            </Button>
          </Stack>
        </Box>
      )}
    </Box>
  );
};

export default AadhaarCapture;
