import { Grid, TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { Restaurant as RestaurantIcon } from '@mui/icons-material';
import FormDialog, { FormSection } from '../../../../components/forms/FormDialog';
import { currencySym } from '../../../../utils/billing';

// Add / edit a single menu item (dish). Controlled by the parent Restaurant page.
const MenuItemDialog = ({
  open,
  onClose,
  onSubmit,
  selectedMenuItem,
  menuItemForm,
  setMenuItemForm,
  categories,
}) => (
  <FormDialog
    open={open}
    onClose={onClose}
    onSubmit={onSubmit}
    maxWidth="sm"
    icon={<RestaurantIcon />}
    eyebrow="Menu"
    title={selectedMenuItem ? 'Edit Menu Item' : 'Add Menu Item'}
    submitLabel="Save"
  >
    <FormSection title="Item Details" icon={<RestaurantIcon fontSize="small" />} iconColor="#f43f5e">
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            label="Name"
            fullWidth
            value={menuItemForm.name}
            onChange={(e) => setMenuItemForm({ ...menuItemForm, name: e.target.value })}
            required
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={menuItemForm.description}
            onChange={(e) => setMenuItemForm({ ...menuItemForm, description: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label={`Price (${currencySym()})`}
            fullWidth
            type="number"
            value={menuItemForm.price}
            onChange={(e) => setMenuItemForm({ ...menuItemForm, price: e.target.value })}
            required
            inputProps={{ min: 0 }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Category</InputLabel>
            <Select
              value={menuItemForm.category}
              onChange={(e) => setMenuItemForm({ ...menuItemForm, category: e.target.value })}
              label="Category"
              required
              MenuProps={{ PaperProps: { sx: { backgroundColor: '#fff' } } }}
            >
              {categories.map((category) => (
                <MenuItem key={category._id} value={category._id}>
                  {category.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              value={menuItemForm.isVeg}
              onChange={(e) => setMenuItemForm({ ...menuItemForm, isVeg: e.target.value })}
              label="Type"
              MenuProps={{ PaperProps: { sx: { backgroundColor: '#fff' } } }}
            >
              <MenuItem value={true}>Vegetarian</MenuItem>
              <MenuItem value={false}>Non-Vegetarian</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Preparation Time (mins)"
            fullWidth
            type="number"
            value={menuItemForm.preparationTime}
            onChange={(e) => setMenuItemForm({ ...menuItemForm, preparationTime: e.target.value })}
            inputProps={{ min: 1 }}
          />
        </Grid>
        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel>Popular</InputLabel>
            <Select
              value={menuItemForm.popular}
              onChange={(e) => setMenuItemForm({ ...menuItemForm, popular: e.target.value })}
              label="Popular"
              MenuProps={{ PaperProps: { sx: { backgroundColor: '#fff' } } }}
            >
              <MenuItem value={true}>Yes</MenuItem>
              <MenuItem value={false}>No</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </FormSection>
  </FormDialog>
);

export default MenuItemDialog;
