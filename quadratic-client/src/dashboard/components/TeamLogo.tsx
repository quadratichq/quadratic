import { Button, Stack, useTheme } from '@mui/material';
import { useRef, useState } from 'react';
import AvatarEditor from 'react-avatar-editor';
import { QDialog } from '../../components/QDialog';

/**
 * URLs return from the logo editor will be file object URLs.
 *
 * Example usage:
 *
 * ```
 * const [currentLogoUrl, currentLogoUrl] = useState<string>('');
 * const [newLogoUrl, setNewLogoUrl] = useState<string>('');
 *
 * return (
 *   <Avatar src={currentLogoUrl} />
 *   <Button component="label">
 *     Upload logo
 *     <TeamLogoInput onChange={(newLogoUrl) => setNewLogoUrl(newLogoUrl)} />
 *   </Button>
 *   {newLogoUrl &&
 *     <TeamLogoDialog
 *        logoUrl={newLogoUrl}
 *        onClose={() => setNewLogoUrl('')}
 *        onSave={(newLogoUrl) => {
 *          // upload newLogoUrl to server
 *          setCurrentLogoUrl(newLogoUrl);
 *          setNewLogoUrl('');
 *        }}
 *     />}
 * )
 * ```
 */

export function TeamLogoInput({ onChange }: { onChange: (logo: string) => void }) {
  const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : undefined;
    if (!file) {
      return;
    }

    const fileAsDataURL = window.URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (img.width > 400 && img.height > 400) {
        onChange(fileAsDataURL);
      } else {
        // TODO
        // addGlobalSnackbar('Image must be at least 400×400 pixels', { severity: 'error' });
      }
    };
    img.src = fileAsDataURL;
  };
  return <input type="file" hidden accept="image/png, image/jpeg" onChange={handleOnChange} />;
}

export function TeamLogoDialog({
  onClose,
  onSave,
  logoUrl,
}: {
  onClose: () => void;
  onSave: (newLogoUrl: string) => void;
  logoUrl: string;
}) {
  const editorRef = useRef<AvatarEditor>(null);
  const theme = useTheme();
  const [scaleInput, setScaleInput] = useState<number>(20);

  // 1 or 1.02 or 1.98 or 2
  const scale = 1 + Math.round(scaleInput * 10) / 1000;

  return (
    <QDialog onClose={onClose} maxWidth="xs">
      <QDialog.Title>Edit icon</QDialog.Title>
      <QDialog.Content>
        <Stack alignItems={'center'} gap={theme.spacing(1)}>
          <AvatarEditor
            ref={editorRef}
            image={logoUrl}
            width={200}
            height={200}
            border={30}
            borderRadius={100}
            // TODO make this black or white depending on the image...
            color={[255, 255, 255, 0.8]}
            scale={scale}
            rotate={0}
          />
          <input
            type="range"
            min={0}
            max={100}
            value={scaleInput}
            onChange={(e) => {
              setScaleInput(Number(e.target.value));
            }}
          />
        </Stack>
      </QDialog.Content>
      <QDialog.Actions>
        <Button variant="outlined" size="small" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disableElevation
          size="small"
          onClick={async () => {
            if (editorRef.current) {
              const dataUrl = editorRef.current.getImageScaledToCanvas().toDataURL();
              const res = await fetch(dataUrl);
              const blob = await res.blob();

              const imageUrl = window.URL.createObjectURL(blob);
              onSave(imageUrl);
            }
          }}
        >
          Save
        </Button>
      </QDialog.Actions>
    </QDialog>
  );
}
