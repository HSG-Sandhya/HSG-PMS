import { Grid, TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { Category as CategoryIcon } from '@mui/icons-material';
import FormDialog, { FormSection } from '../../../../components/forms/FormDialog';

// Add / edit a menu category.
const CategoryDialog = ({ open, onClose, onSubmit, selectedCategory, categoryForm, setCategoryForm }) => (
  <FormDialog
    open={open}
    onClose={onClose}
    onSubmit={onSubmit}
    maxWidth="sm"
    icon={<CategoryIcon />}
    eyebrow="Menu"
    title={selectedCategory ? 'Edit Category' : 'Add Category'}
    submitLabel="Save"
  >
    <FormSection title="Category Details" icon={<CategoryIcon fontSize="small" />} iconColor="#f43f5e">
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            label="Name"
            fullWidth
            value={categoryForm.name}
            onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
            required
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Description"
            fullWidth
            multiline
            rows={2}
            value={categoryForm.description}
            onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Display Order"
            fullWidth
            type="number"
            value={categoryForm.displayOrder}
            onChange={(e) => setCategoryForm({ ...categoryForm, displayOrder: e.target.value })}
            inputProps={{ min: 1 }}
            helperText="Lower numbers appear first"
          />
        </Grid>
        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel>Food Type</InputLabel>
            <Select
              value={categoryForm.isVegOnly}
              onChange={(e) => setCategoryForm({ ...categoryForm, isVegOnly: e.target.value })}
              label="Food Type"
              MenuProps={{ PaperProps: { sx: { backgroundColor: '#fff' } } }}
            >
              <MenuItem value={false}>All Food (Veg & Non-Veg)</MenuItem>
              <MenuItem value={true}>Vegetarian Only</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </FormSection>
  </FormDialog>
);

export default CategoryDialog;
