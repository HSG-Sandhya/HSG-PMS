import { Box, Button, Typography, Grid, IconButton, Tooltip } from '@mui/material';
import {
  Add as AddIcon,
  Category as CategoryIcon,
  UploadFile as UploadFileIcon,
  EditRounded as EditIcon,
  DeleteRounded as DeleteIcon,
} from '@mui/icons-material';
import { currencySym } from '../../../../utils/billing';

const OUTLINED_PILL = {
  borderRadius: '999px',
  px: 3,
  py: 1.2,
  textTransform: 'none',
  fontWeight: 700,
  borderColor: 'rgba(var(--app-primary-rgb),0.4)',
  color: 'var(--app-primary)',
  '&:hover': { borderColor: 'var(--app-primary)', background: 'rgba(var(--app-primary-rgb),0.06)', transform: 'translateY(-2px)' },
};

// Modern soft-tinted rounded-square action buttons (edit / delete).
const ACTION_BTN_BASE = {
  width: 30,
  height: 30,
  borderRadius: '9px',
  transition: 'transform 0.16s ease, background 0.18s ease, box-shadow 0.18s ease',
  '&:active': { transform: 'scale(0.9)' },
};
const ACTION_EDIT_SX = {
  ...ACTION_BTN_BASE,
  color: 'var(--app-primary)',
  background: 'rgba(var(--app-primary-rgb), 0.10)',
  border: '1px solid rgba(var(--app-primary-rgb), 0.18)',
  '&:hover': { background: 'rgba(var(--app-primary-rgb), 0.18)', transform: 'translateY(-1px)', boxShadow: '0 4px 10px -3px rgba(var(--app-primary-rgb), 0.4)' },
  '&:active': { transform: 'scale(0.9)' },
};
const ACTION_DELETE_SX = {
  ...ACTION_BTN_BASE,
  color: '#e11d48',
  background: 'rgba(225, 29, 72, 0.10)',
  border: '1px solid rgba(225, 29, 72, 0.18)',
  '&:hover': { background: 'rgba(225, 29, 72, 0.18)', transform: 'translateY(-1px)', boxShadow: '0 4px 10px -3px rgba(225, 29, 72, 0.45)' },
  '&:active': { transform: 'scale(0.9)' },
};

// Row tint by diet: green for veg, red for non-veg. Layered over the glass sheen
// so it reads as a soft colour wash with a solid left accent bar.
const VEG_TINT = {
  bg: 'linear-gradient(0deg, rgba(22, 163, 74, 0.16), rgba(22, 163, 74, 0.16))',
  border: 'rgba(22, 163, 74, 0.30)',
  accent: '#16a34a',
  shadow: 'rgba(22, 163, 74, 0.32)',
};
const NONVEG_TINT = {
  bg: 'linear-gradient(0deg, rgba(220, 38, 38, 0.16), rgba(220, 38, 38, 0.16))',
  border: 'rgba(220, 38, 38, 0.30)',
  accent: '#dc2626',
  shadow: 'rgba(220, 38, 38, 0.32)',
};

// Small veg / non-veg square marker (green for veg, red for non-veg).
const VegMark = ({ isVeg }) => (
  <Box
    component="span"
    sx={{
      width: 14,
      height: 14,
      flexShrink: 0,
      borderRadius: '3px',
      border: '2px solid',
      borderColor: isVeg ? '#16a34a' : '#dc2626',
      position: 'relative',
      '&::after': {
        content: '""',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: isVeg ? '#16a34a' : '#dc2626',
      },
    }}
  />
);

// Short, sharp synthesized "tick" so the power switch has tactile audio feedback.
// Bright rising click when switching ON, quick falling click when OFF. Uses the
// Web Audio API (no asset needed); silently no-ops if audio is unavailable/blocked.
let audioCtx;
const playSwitchSound = (turningOn) => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(turningOn ? 920 : 540, t);
    osc.frequency.exponentialRampToValueAtTime(turningOn ? 1600 : 260, t + 0.035);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.2, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.09);
  } catch { /* audio not supported / blocked — ignore */ }
};

// Group the (already filtered + sorted) items under their category, keeping the
// category order from the categories list and appending any uncategorized items.
const groupByCategory = (categories, items) => {
  const groups = categories
    .map((category) => ({ category, items: items.filter((it) => it.category && it.category._id === category._id) }))
    .filter((g) => g.items.length > 0);
  const uncategorized = items.filter((it) => !it.category || !categories.some((c) => c._id === it.category._id));
  if (uncategorized.length) {
    groups.push({ category: { _id: '__uncategorized', name: 'Uncategorized' }, items: uncategorized });
  }
  return groups;
};

// "Menu Items" tab: filters, action buttons, category chips and the item list.
// Items are shown as a simple two-column list grouped by category, with the
// name on the left and the price (plus edit/delete) on the right.
// `menuFilters` is the shared filter toolbar rendered by the parent.
// `onMenuItemDialog`/`onCategoryDialog` open the dialogs (call with an item/
// category to edit, or with no argument to create).
const MenuItemsTab = ({
  menuFilters,
  onMenuItemDialog,
  onCategoryDialog,
  onUploadCSV,
  onDeleteItem,
  onToggleAvailability,
  categories,
  filteredMenuItems,
  fontFamily,
  fontSize,
}) => {
  const groups = groupByCategory(categories, filteredMenuItems);

  return (
    <Box>
      {/* Search and Filter Controls */}
      {menuFilters}
      {/* Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, gap: 1.5, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => onMenuItemDialog()}
          sx={{
            borderRadius: '999px',
            px: 3,
            py: 1.2,
            textTransform: 'none',
            fontWeight: 700,
            boxShadow: '0 8px 20px rgba(var(--app-primary-rgb),0.25)',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 12px 26px rgba(var(--app-primary-rgb),0.35)' },
          }}
        >
          Add Menu Item
        </Button>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<CategoryIcon />} onClick={() => onCategoryDialog()} sx={OUTLINED_PILL}>
            Manage Categories
          </Button>
          <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={onUploadCSV} sx={OUTLINED_PILL}>
            Upload CSV
          </Button>
        </Box>
      </Box>
      {/* Menu Items grouped by category, two-column list */}
      {groups.map(({ category, items }) => (
        <Box key={category._id} sx={{ mb: 4 }}>
          <Typography
            variant="h6"
            sx={{ mb: 1.5, fontWeight: 700, color: '#2c3e50', display: 'flex', alignItems: 'center', gap: 1 }}
          >
            {category.name}
            <Typography component="span" variant="body2" sx={{
              color: "text.secondary"
            }}>
              ({items.length})
            </Typography>
          </Typography>
          <Grid container spacing={1.5}>
            {items.map((item) => {
              const available = item.isAvailable !== false;
              const tint = item.isVeg ? VEG_TINT : NONVEG_TINT;
              return (
                <Grid
                  key={item._id}
                  size={{
                    xs: 12,
                    sm: 6
                  }}>
                  <Tooltip title={available ? 'Available — tap row to mark Sold out' : 'Sold out — tap row to mark Available'} disableInteractive>
                    <Box
                      role="button"
                      tabIndex={0}
                      aria-pressed={available}
                      onClick={() => { playSwitchSound(!available); onToggleAvailability(item); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          playSwitchSound(!available);
                          onToggleAvailability(item);
                        }
                      }}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                        px: 2,
                        py: 1.25,
                        borderRadius: '12px',
                        cursor: 'pointer',
                        userSelect: 'none',
                        outline: 'none',
                        background: available
                          ? `${tint.bg}, var(--app-glass-sheen), rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))`
                          : 'linear-gradient(0deg, rgba(120, 120, 120, 0.14), rgba(120, 120, 120, 0.14)), var(--app-glass-sheen), rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))',
                        backdropFilter: 'var(--app-blur)',
                        border: `1px solid ${available ? tint.border : 'rgba(120, 120, 120, 0.30)'}`,
                        borderLeft: `4px solid ${available ? tint.accent : '#9ca3af'}`,
                        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
                        // Faded when sold out.
                        opacity: available ? 1 : 0.45,
                        filter: available ? 'none' : 'grayscale(0.35)',
                        fontFamily,
                        fontSize,
                        transition: 'box-shadow 0.2s ease, transform 0.14s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease, filter 0.25s ease',
                        '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 10px 24px -10px ${available ? tint.shadow : 'rgba(120,120,120,0.32)'}` },
                        '&:focus-visible': { boxShadow: `0 0 0 3px ${available ? 'rgba(16,185,129,0.35)' : 'rgba(120,120,120,0.3)'}` },
                        // Tap in / out press feedback for the whole row.
                        '&:active': { transform: 'scale(0.985)', boxShadow: 'inset 0 2px 10px rgba(0, 0, 0, 0.12)' },
                      }}
                    >
                      {/* Left: veg mark + name */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, flex: 1 }}>
                        <VegMark isVeg={item.isVeg} />
                        <Typography noWrap sx={{ fontWeight: 600, color: '#2c3e50' }}>
                          {item.name}
                        </Typography>
                      </Box>

                      {/* Right: price + actions (actions don't trigger the row toggle) */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                        <Typography sx={{ fontWeight: 800, color: '#667eea', minWidth: 46, textAlign: 'right' }}>
                          {currencySym()}{item.price}
                        </Typography>
                        <Tooltip title="Edit item">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onMenuItemDialog(item); }} sx={ACTION_EDIT_SX}>
                            <EditIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete item">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDeleteItem(item._id); }} sx={ACTION_DELETE_SX}>
                            <DeleteIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </Tooltip>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      ))}
    </Box>
  );
};

export default MenuItemsTab;
