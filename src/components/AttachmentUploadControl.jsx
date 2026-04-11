import React from 'react';
import { alpha } from '@mui/material/styles';
import { Box, Button, Stack, Typography } from '@mui/material';

const AttachmentUploadControl = ({
  instructions,
  isDropActive = false,
  onDragOver,
  onDragLeave,
  onDrop,
  chooseButtonLabel,
  inputKey = 0,
  multiple = false,
  accept = 'image/*,video/*',
  onFileChange,
  selectedContent = null,
  trailingAction = null,
  chooseDisabled = false,
}) => (
  <Box
    onDragOver={onDragOver}
    onDragLeave={onDragLeave}
    onDrop={onDrop}
    sx={(theme) => ({
      border: '1px dashed',
      borderColor: isDropActive ? 'primary.main' : 'divider',
      borderRadius: 1.25,
      p: 1.5,
      backgroundColor: isDropActive
        ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.08)
        : 'transparent',
    })}
  >
    <Stack spacing={1.25}>
      <Typography variant="body2" color="text.secondary">
        {instructions}
      </Typography>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flex: 1 }}>
          <Button
            variant="outlined"
            component="label"
            type="button"
            disabled={chooseDisabled}
            sx={{ minHeight: 40, width: { xs: '100%', sm: 'auto' } }}
          >
            {chooseButtonLabel}
            <input
              key={inputKey}
              type="file"
              hidden
              multiple={multiple}
              accept={accept}
              onChange={onFileChange}
            />
          </Button>
          {selectedContent}
        </Stack>
        {trailingAction}
      </Stack>
    </Stack>
  </Box>
);

export default AttachmentUploadControl;
