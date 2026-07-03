import { Box, Typography, Button } from '@mui/material';
import { UploadFile as UploadFileIcon } from '@mui/icons-material';
import FormDialog, { FormSection } from '../../../../components/forms/FormDialog';

const SAMPLE_CSV = `name,price,category,description,isVeg,preparationTime,popular,isAvailable
Butter Chicken,280,Main Course,Creamy tomato-based chicken curry,false,25,true,true
Paneer Tikka,220,Appetizers,Grilled cottage cheese with spices,true,20,true,true
Masala Dosa,150,South Indian,Crispy crepe with spiced potato filling,true,15,false,true
Biryani,320,Rice Dishes,Aromatic basmati rice with chicken,false,35,true,true`;

const FIELD_DOCS = [
  ['Name', '(required): Menu item name', 'Accepts: name, Item Name, item_name, itemName'],
  ['Price', '(required): Price in numbers (e.g., 150.50)', 'Accepts: price, Price (INR), price_inr, Price'],
  ['Category', "(required): Category name (will be created if doesn't exist)", 'Accepts: category, Category, category_name'],
  ['Description', '(optional): Item description', 'Accepts: description, Description, desc'],
  ['Vegetarian', '(optional): Veg/Non-Veg (default: Veg)', 'Accepts: isVeg, Veg/Non-Veg, veg_non_veg, type'],
  ['Preparation Time', '(optional): Time in minutes (default: 15)', 'Accepts: preparationTime, Preparation Time (mins), prep_time'],
  ['Popular', '(optional): true/false, yes/no, 1/0 (default: false)', 'Accepts: popular, Popular, is_popular'],
  ['Available', '(optional): true/false, yes/no, 1/0 (default: true)', 'Accepts: isAvailable, Availability, available, is_available'],
];

// Bulk-import menu items from a CSV file.
const CSVUploadDialog = ({ open, onClose, onUpload, csvFile, onFileChange, loading }) => (
  <FormDialog
    open={open}
    onClose={onClose}
    onSubmit={(e) => { if (e?.preventDefault) e.preventDefault(); onUpload(); }}
    maxWidth="md"
    icon={<UploadFileIcon />}
    eyebrow="Menu"
    title="Upload Menu CSV"
    submitDisabled={!csvFile || loading}
    submitLabel={loading ? 'Uploading...' : 'Upload CSV'}
  >
    <FormSection title="Bulk Import" icon={<UploadFileIcon fontSize="small" />} iconColor="#6366f1">
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Upload a CSV file to bulk import menu items. Your CSV file should include the following columns:
        </Typography>

        {/* CSV Format Instructions */}
        <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, border: '1px solid', borderColor: 'grey.200', mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            Required CSV Format:
          </Typography>
          <Typography variant="body2" component="div" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
            <strong>name,price,category,description,isVeg,preparationTime,popular,isAvailable</strong>
          </Typography>

          <Typography variant="body2" sx={{ mt: 2, mb: 1 }}>
            <strong>Field Descriptions (Flexible Column Names):</strong>
          </Typography>
          <Box component="ul" sx={{ pl: 2, m: 0 }}>
            {FIELD_DOCS.map(([name, desc, accepts]) => (
              <Typography component="li" variant="body2" key={name}>
                <strong>{name}</strong> {desc}
                <br />
                <em style={{ fontSize: '0.75rem', color: '#666' }}>{accepts}</em>
              </Typography>
            ))}
          </Box>
        </Box>

        {/* Sample CSV Data */}
        <Box sx={{ p: 2, bgcolor: 'primary.50', borderRadius: 2, border: '1px solid', borderColor: 'primary.200', mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Sample CSV Data:
            </Typography>
            <Button
              size="small"
              variant="outlined"
              href="/sample-menu.csv"
              download="sample-menu.csv"
              sx={{ fontSize: '0.75rem', py: 0.5, px: 1 }}
            >
              Download Template
            </Button>
          </Box>
          <Typography variant="body2" component="div" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-line' }}>
            {SAMPLE_CSV}
          </Typography>
        </Box>

        {/* File Upload */}
        <Box sx={{
          border: '2px dashed',
          borderColor: csvFile ? 'success.main' : 'grey.300',
          borderRadius: 2,
          p: 3,
          textAlign: 'center',
          bgcolor: csvFile ? 'success.50' : 'grey.50',
          transition: 'all 0.3s ease',
        }}>
          <input
            type="file"
            accept=".csv"
            onChange={onFileChange}
            style={{ display: 'none' }}
            id="csv-file-input"
          />
          <label htmlFor="csv-file-input">
            <Button variant="outlined" component="span" startIcon={<UploadFileIcon />} sx={{ mb: 1 }}>
              Choose CSV File
            </Button>
          </label>
          {csvFile && (
            <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
              Selected: {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
            </Typography>
          )}
          {!csvFile && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Select a CSV file to upload menu items
            </Typography>
          )}
        </Box>
      </Box>
    </FormSection>
  </FormDialog>
);

export default CSVUploadDialog;
