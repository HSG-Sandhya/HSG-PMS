import { Grid, TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { TableRestaurant as TableRestaurantIcon } from '@mui/icons-material';
import FormDialog, { FormSection } from '../../../../components/forms/FormDialog';

const FILLED = { sx: { borderRadius: 2, background: 'rgba(255,255,255,0.7)' } };

// Add / edit a dining table on the floor plan.
const TableDialog = ({ open, onClose, onSubmit, selectedTable, tableForm, setTableForm }) => (
  <FormDialog
    open={open}
    onClose={onClose}
    onSubmit={onSubmit}
    maxWidth="sm"
    icon={<TableRestaurantIcon />}
    eyebrow="Floor Plan"
    title={selectedTable ? 'Edit Table' : 'Add Table'}
    submitLabel="Save"
  >
    <FormSection title="Table Details" icon={<TableRestaurantIcon fontSize="small" />} iconColor="#f43f5e">
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Table Number"
            fullWidth
            value={tableForm.number}
            onChange={(e) => setTableForm({ ...tableForm, number: e.target.value })}
            required
            variant="filled"
            InputProps={FILLED}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Capacity"
            fullWidth
            type="number"
            value={tableForm.capacity}
            onChange={(e) => setTableForm({ ...tableForm, capacity: e.target.value })}
            inputProps={{ min: 1 }}
            required
            variant="filled"
            InputProps={FILLED}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth variant="filled" sx={{ borderRadius: 2, background: 'rgba(255,255,255,0.7)' }}>
            <InputLabel>Floor</InputLabel>
            <Select
              value={tableForm.floor}
              onChange={(e) => setTableForm({ ...tableForm, floor: e.target.value })}
              label="Floor"
              MenuProps={{ PaperProps: { sx: { backgroundColor: '#fff' } } }}
            >
              <MenuItem value="Ground Floor">Ground Floor</MenuItem>
              <MenuItem value="First Floor">First Floor</MenuItem>
              <MenuItem value="Second Floor">Second Floor</MenuItem>
              <MenuItem value="Terrace">Terrace</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth variant="filled" sx={{ borderRadius: 2, background: 'rgba(255,255,255,0.7)' }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={tableForm.status}
              onChange={(e) => setTableForm({ ...tableForm, status: e.target.value })}
              label="Status"
              MenuProps={{ PaperProps: { sx: { backgroundColor: '#fff' } } }}
            >
              <MenuItem value="Available">Available</MenuItem>
              <MenuItem value="Occupied">Occupied</MenuItem>
              <MenuItem value="Reserved">Reserved</MenuItem>
              <MenuItem value="Maintenance">Maintenance</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          <FormControl fullWidth variant="filled" sx={{ borderRadius: 2, background: 'rgba(255,255,255,0.7)' }}>
            <InputLabel>Section</InputLabel>
            <Select
              value={tableForm.section}
              onChange={(e) => setTableForm({ ...tableForm, section: e.target.value })}
              label="Section"
              MenuProps={{ PaperProps: { sx: { backgroundColor: '#fff' } } }}
            >
              <MenuItem value="Main">Main</MenuItem>
              <MenuItem value="Outdoor">Outdoor</MenuItem>
              <MenuItem value="Private">Private</MenuItem>
              <MenuItem value="Bar">Bar</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Notes"
            fullWidth
            multiline
            rows={2}
            value={tableForm.notes}
            onChange={(e) => setTableForm({ ...tableForm, notes: e.target.value })}
            variant="filled"
            InputProps={FILLED}
          />
        </Grid>
      </Grid>
    </FormSection>
  </FormDialog>
);

export default TableDialog;
