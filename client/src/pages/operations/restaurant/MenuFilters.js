import { Box, Grid, TextField, FormControl, InputLabel, Select, MenuItem, Button, Typography } from '@mui/material';
import { Search as SearchIcon, Clear as ClearIcon, LocalFlorist as EcoIcon } from '@mui/icons-material';

const MENU_PAPER = {
  slotProps: {
    paper: {
      sx: {
        backgroundColor: '#fff',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        borderRadius: '8px',
        border: '1px solid rgba(0,0,0,0.1)',
      },
    }
  },
};

// Search / category / sort / veg / availability toolbar for the menu.
// Shared by the Menu Items tab and the Order dialog.
const MenuFilters = ({
  menuSearchTerm,
  setMenuSearchTerm,
  selectedCategory,
  setSelectedCategory,
  categories,
  sortBy,
  setSortBy,
  showVegOnly,
  setShowVegOnly,
  showAvailableOnly,
  setShowAvailableOnly,
  resetFilters,
  filteredCount,
  totalCount,
}) => (
  <Box sx={{
    p: 2,
    mb: 3,
    borderRadius: '16px',
    background: 'rgba(255, 255, 255, 0.25)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
  }}>
    <Grid container spacing={2} sx={{
      alignItems: "center"
    }}>
      <Grid
        size={{
          xs: 12,
          sm: 4
        }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search menu items..."
          value={menuSearchTerm}
          onChange={(e) => setMenuSearchTerm(e.target.value)}
          slotProps={{
            input: {
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
              endAdornment: menuSearchTerm && (
                <ClearIcon sx={{ cursor: 'pointer', color: 'text.secondary' }} onClick={() => setMenuSearchTerm('')} />
              ),
            }
          }}
        />
      </Grid>

      <Grid
        size={{
          xs: 12,
          sm: 2
        }}>
        <FormControl fullWidth size="small">
          <InputLabel>Category</InputLabel>
          <Select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} label="Category" MenuProps={MENU_PAPER}>
            <MenuItem value="All">All</MenuItem>
            {categories.map((cat) => (
              <MenuItem key={cat._id} value={cat._id}>{cat.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid
        size={{
          xs: 12,
          sm: 2
        }}>
        <FormControl fullWidth size="small">
          <InputLabel>Sort</InputLabel>
          <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} label="Sort" MenuProps={MENU_PAPER}>
            <MenuItem value="name">Name</MenuItem>
            <MenuItem value="price">Price</MenuItem>
            <MenuItem value="popular">Popular</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      <Grid
        size={{
          xs: 12,
          sm: 4
        }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" variant={showVegOnly ? 'contained' : 'outlined'} onClick={() => setShowVegOnly(!showVegOnly)} startIcon={<EcoIcon />} color="success">
            Veg
          </Button>
          <Button size="small" variant={showAvailableOnly ? 'contained' : 'outlined'} onClick={() => setShowAvailableOnly(!showAvailableOnly)}>
            Available
          </Button>
          <Button size="small" onClick={resetFilters} startIcon={<ClearIcon />}>
            Reset
          </Button>
        </Box>
      </Grid>
    </Grid>

    <Typography
      variant="body2"
      sx={{
        color: "text.secondary",
        mt: 1
      }}>
      {filteredCount} of {totalCount} items
    </Typography>
  </Box>
);

export default MenuFilters;
