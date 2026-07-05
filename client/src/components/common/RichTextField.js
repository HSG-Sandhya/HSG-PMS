import { useRef, useEffect, useState } from 'react';
import { Box, Typography, IconButton, Tooltip, Select, MenuItem, Divider } from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import FormatColorTextIcon from '@mui/icons-material/FormatColorText';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import FormatClearIcon from '@mui/icons-material/FormatClear';

// Lightweight, dependency-free rich-text editor built on a contentEditable div
// + document.execCommand. Stores HTML (`value`/`onChange`). Deliberately avoids
// a heavy editor library so it stays compatible with React 19 and adds no deps.
//
// Formatting offered: bold, italic, underline, font size, text colour, bullet/
// numbered lists, and clear-formatting. execCommand is technically deprecated
// but is still supported in every current browser and is ideal for a simple,
// admin-authored field like the hotel description.

// HTML font-size buckets (1–7) exposed as friendly labels.
const SIZES = [
  { label: 'Small', value: '2' },
  { label: 'Normal', value: '3' },
  { label: 'Large', value: '5' },
  { label: 'Huge', value: '6' },
];

// Font families offered in the toolbar (label → CSS font stack).
const FONTS = [
  { label: 'Default', value: 'Inter, system-ui, sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Mono', value: '"Courier New", monospace' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times', value: '"Times New Roman", Times, serif' },
  { label: 'Poppins', value: 'Poppins, "Segoe UI", sans-serif' },
];

const RichTextField = ({ label, value, onChange, placeholder = '', minHeight = 120 }) => {
  const ref = useRef(null);
  const [size, setSize] = useState('3');
  const [font, setFont] = useState(FONTS[0].value);
  const [color, setColor] = useState('#1e293b');

  // Seed / re-sync the editor's HTML from `value` without clobbering the caret:
  // only write when the incoming value actually differs from what's rendered
  // (during typing they're equal, so this is a no-op and the caret stays put).
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || '')) {
      ref.current.innerHTML = value || '';
    }
  }, [value]);

  const emit = () => onChange?.(ref.current?.innerHTML || '');

  const exec = (command, arg) => {
    ref.current?.focus();
    try { document.execCommand('styleWithCSS', false, true); } catch { /* older browsers */ }
    document.execCommand(command, false, arg);
    emit();
  };

  // Keep clicks on the toolbar from stealing focus / collapsing the selection.
  const hold = (e) => e.preventDefault();

  const btnSx = { borderRadius: 1.5, color: 'text.secondary', '&:hover': { color: 'var(--app-primary)' } };

  return (
    <Box>
      {label && (
        <Typography variant="caption" sx={{ display: 'block', mb: 0.5, ml: 0.5, color: 'text.secondary', fontWeight: 600 }}>
          {label}
        </Typography>
      )}
      <Box
        sx={{
          border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden',
          transition: 'border-color .2s, box-shadow .2s',
          '&:focus-within': { borderColor: 'var(--app-primary)', boxShadow: '0 0 0 3px rgba(var(--app-primary-rgb),0.15)' },
        }}
      >
        {/* Toolbar */}
        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.25, flexWrap: 'wrap', p: 0.5,
            borderBottom: '1px solid', borderColor: 'divider',
            background: 'rgba(var(--app-primary-rgb),0.04)',
          }}
        >
          <Tooltip title="Bold"><IconButton size="small" sx={btnSx} onMouseDown={hold} onClick={() => exec('bold')}><FormatBoldIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Italic"><IconButton size="small" sx={btnSx} onMouseDown={hold} onClick={() => exec('italic')}><FormatItalicIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Underline"><IconButton size="small" sx={btnSx} onMouseDown={hold} onClick={() => exec('underline')}><FormatUnderlinedIcon fontSize="small" /></IconButton></Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />

          <Select
            size="small" value={font} variant="standard" disableUnderline
            onMouseDown={hold}
            onChange={(e) => { setFont(e.target.value); exec('fontName', e.target.value); }}
            renderValue={(v) => FONTS.find((f) => f.value === v)?.label || 'Font'}
            sx={{ fontSize: 13, minWidth: 92, '& .MuiSelect-select': { py: 0.25, px: 0.75 } }}
          >
            {FONTS.map((f) => <MenuItem key={f.label} value={f.value} sx={{ fontSize: 14, fontFamily: f.value }}>{f.label}</MenuItem>)}
          </Select>

          <Select
            size="small" value={size} variant="standard" disableUnderline
            onMouseDown={hold}
            onChange={(e) => { setSize(e.target.value); exec('fontSize', e.target.value); }}
            sx={{ fontSize: 13, minWidth: 78, '& .MuiSelect-select': { py: 0.25, px: 0.75 } }}
          >
            {SIZES.map((s) => <MenuItem key={s.value} value={s.value} sx={{ fontSize: 13 }}>{s.label}</MenuItem>)}
          </Select>

          {/* Text colour — native swatch drives execCommand('foreColor') */}
          <Tooltip title="Text colour">
            <IconButton size="small" component="label" sx={btnSx} onMouseDown={hold}>
              <FormatColorTextIcon fontSize="small" sx={{ color }} />
              <input
                type="color" value={color}
                onChange={(e) => { setColor(e.target.value); exec('foreColor', e.target.value); }}
                style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
              />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />

          <Tooltip title="Bulleted list"><IconButton size="small" sx={btnSx} onMouseDown={hold} onClick={() => exec('insertUnorderedList')}><FormatListBulletedIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Numbered list"><IconButton size="small" sx={btnSx} onMouseDown={hold} onClick={() => exec('insertOrderedList')}><FormatListNumberedIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Clear formatting"><IconButton size="small" sx={btnSx} onMouseDown={hold} onClick={() => exec('removeFormat')}><FormatClearIcon fontSize="small" /></IconButton></Tooltip>
        </Box>

        {/* Editable area */}
        <Box
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={emit}
          onBlur={emit}
          sx={{
            minHeight, p: 1.5, fontSize: 15, lineHeight: 1.6, outline: 'none', overflowY: 'auto',
            '& p': { m: 0 },
            '&:empty:before': { content: 'attr(data-placeholder)', color: 'text.disabled' },
          }}
        />
      </Box>
    </Box>
  );
};

export default RichTextField;
