import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import ZoomIn from '@mui/icons-material/ZoomIn';
import ZoomOut from '@mui/icons-material/ZoomOut';
import { PROFILE_PHOTO_OUTPUT_MAX_BYTES } from '../profilePhotoConstants.js';

/** Square viewport (px); exported avatar is scaled up for quality. */
const VIEWPORT_PX = 280;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function computeLayout(naturalW, naturalH, zoom) {
  if (!naturalW || !naturalH) return { S: 1, W: 0, H: 0 };
  const S0 = Math.max(VIEWPORT_PX / naturalW, VIEWPORT_PX / naturalH);
  const S = S0 * zoom;
  return { S, W: naturalW * S, H: naturalH * S };
}

function clampPan(panX, panY, W, H) {
  const half = VIEWPORT_PX / 2;
  const minPanX = half - W / 2;
  const maxPanX = W / 2 - half;
  const minPanY = half - H / 2;
  const maxPanY = H / 2 - half;
  return {
    panX: clamp(panX, minPanX, maxPanX),
    panY: clamp(panY, minPanY, maxPanY),
  };
}

const OUTPUT_SIZE_STEPS = [512, 448, 384, 320, 256, 224, 192, 160, 128];

/**
 * Renders the circular crop to a JPEG Blob at the given square size and quality.
 */
function renderCroppedJpegBlobAt(img, zoom, panX, panY, outputPx, quality) {
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const { W, H } = computeLayout(nw, nh, zoom);
  const { panX: px, panY: py } = clampPan(panX, panY, W, H);

  const canvas = document.createElement('canvas');
  canvas.width = outputPx;
  canvas.height = outputPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('canvas_context'));

  const scaleOut = outputPx / VIEWPORT_PX;
  ctx.scale(scaleOut, scaleOut);

  const cx = VIEWPORT_PX / 2;
  const cy = VIEWPORT_PX / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, VIEWPORT_PX / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  const imgLeft = cx - W / 2 + px;
  const imgTop = cy - H / 2 + py;
  ctx.drawImage(img, imgLeft, imgTop, W, H);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('toBlob_failed'));
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * Iteratively lowers JPEG quality and output size until the blob fits PROFILE_PHOTO_OUTPUT_MAX_BYTES.
 */
async function renderCroppedJpegBlobCapped(img, zoom, panX, panY) {
  const maxBytes = PROFILE_PHOTO_OUTPUT_MAX_BYTES;
  let lastBlob = null;
  for (const outPx of OUTPUT_SIZE_STEPS) {
    let q = 0.92;
    while (q >= 0.34) {
      lastBlob = await renderCroppedJpegBlobAt(img, zoom, panX, panY, outPx, q);
      if (lastBlob.size <= maxBytes) return lastBlob;
      q -= 0.06;
    }
  }
  return lastBlob;
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {File|null} props.file
 * @param {() => void} props.onClose
 * @param {(blob: Blob) => void | Promise<void>} props.onSave
 */
export default function ProfilePhotoEditorDialog({ open, file, onClose, onSave }) {
  const { t } = useTranslation();
  const imgRef = useRef(null);
  const [objectUrl, setObjectUrl] = useState('');
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, panX: 0, panY: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !file) {
      setObjectUrl('');
      setNaturalSize({ w: 0, h: 0 });
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setZoom(MIN_ZOOM);
    setPan({ x: 0, y: 0 });
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [open, file]);

  const onImgLoad = useCallback((e) => {
    const el = e.currentTarget;
    setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight });
  }, []);

  const { W, H } = useMemo(
    () => computeLayout(naturalSize.w, naturalSize.h, zoom),
    [naturalSize.w, naturalSize.h, zoom]
  );

  const clampedPan = useMemo(() => clampPan(pan.x, pan.y, W, H), [pan.x, pan.y, W, H]);

  useEffect(() => {
    if (!naturalSize.w || !W || !H) return;
    setPan((p) => {
      const c = clampPan(p.x, p.y, W, H);
      if (c.panX === p.x && c.panY === p.y) return p;
      return { x: c.panX, y: c.panY };
    });
  }, [zoom, naturalSize.w, naturalSize.h, W, H]);

  const startDrag = (clientX, clientY) => {
    setDragging(true);
    const c = clampPan(pan.x, pan.y, W, H);
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      panX: c.panX,
      panY: c.panY,
    };
  };

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startDrag(e.clientX, e.clientY);
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    const { startX, startY, panX: sx, panY: sy } = dragRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const next = clampPan(sx + dx, sy + dy, W, H);
    setPan({ x: next.panX, y: next.panY });
  };

  const onPointerUp = (e) => {
    if (dragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    setDragging(false);
  };

  const handleZoomDelta = (delta) => {
    setZoom((z) => {
      const nz = clamp(z + delta, MIN_ZOOM, MAX_ZOOM);
      return Math.round(nz * 20) / 20;
    });
  };

  const handleSave = async () => {
    const img = imgRef.current;
    if (!img?.complete || !naturalSize.w) return;
    setSaving(true);
    try {
      const blob = await renderCroppedJpegBlobCapped(
        img,
        zoom,
        clampedPan.panX,
        clampedPan.panY
      );
      if (!blob) return;
      await onSave(blob);
      onClose();
    } catch {
      /* Parent shows feedback and may rethrow; keep dialog open */
    } finally {
      setSaving(false);
    }
  };

  const imgLeft = VIEWPORT_PX / 2 - W / 2 + clampedPan.panX;
  const imgTop = VIEWPORT_PX / 2 - H / 2 + clampedPan.panY;

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: { sx: { backgroundImage: 'none' } },
      }}
      aria-labelledby="profile-photo-editor-title"
    >
      <DialogTitle id="profile-photo-editor-title">
        {t('portalProfile.photoPreview.title')}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            {t('portalProfile.photoPreview.hint')}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Box
              role="presentation"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              sx={{
                width: VIEWPORT_PX,
                height: VIEWPORT_PX,
                borderRadius: '50%',
                overflow: 'hidden',
                position: 'relative',
                touchAction: 'none',
                cursor: dragging ? 'grabbing' : 'grab',
                bgcolor: 'action.hover',
                border: 1,
                borderColor: 'divider',
              }}
            >
              {objectUrl ? (
                <img
                  ref={imgRef}
                  src={objectUrl}
                  alt=""
                  onLoad={onImgLoad}
                  draggable={false}
                  style={{
                    position: 'absolute',
                    left: imgLeft,
                    top: imgTop,
                    width: W,
                    height: H,
                    userSelect: 'none',
                    pointerEvents: 'none',
                  }}
                />
              ) : null}
            </Box>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 0.5 }}>
            <IconButton
              type="button"
              size="small"
              onClick={() => handleZoomDelta(-0.15)}
              disabled={zoom <= MIN_ZOOM || saving}
              aria-label={t('portalProfile.photoPreview.zoomOut')}
            >
              <ZoomOut fontSize="small" />
            </IconButton>
            <Slider
              size="small"
              value={zoom}
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.05}
              onChange={(_, v) => setZoom(Array.isArray(v) ? MIN_ZOOM : v)}
              disabled={saving || !naturalSize.w}
              aria-label={t('portalProfile.photoPreview.zoom')}
              sx={{ flex: 1 }}
            />
            <IconButton
              type="button"
              size="small"
              onClick={() => handleZoomDelta(0.15)}
              disabled={zoom >= MAX_ZOOM || saving}
              aria-label={t('portalProfile.photoPreview.zoomIn')}
            >
              <ZoomIn fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button type="button" onClick={onClose} disabled={saving}>
          {t('portalProfile.photoPreview.cancel')}
        </Button>
        <Button type="button" variant="contained" onClick={handleSave} disabled={saving || !naturalSize.w}>
          {saving ? t('portalProfile.photoUploading') : t('portalProfile.photoPreview.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
