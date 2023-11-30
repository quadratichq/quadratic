import { Button } from '@/shadcn/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shadcn/ui/dialog';
import { Slider } from '@/shadcn/ui/slider';
import { useRef, useState } from 'react';
import AvatarEditor from 'react-avatar-editor';

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
  const [scaleInput, setScaleInput] = useState<number>(20);

  // 1 or 1.02 or 1.98 or 2
  const scale = 1 + Math.round(scaleInput * 10) / 1000;

  return (
    <Dialog onOpenChange={onClose} open={true}>
      <DialogContent className={`max-w-sm`}>
        <DialogHeader>
          <DialogTitle>Edit icon</DialogTitle>
        </DialogHeader>
        <div className={`mb-2 flex flex-col items-center gap-6`}>
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
          <div className={`w-[200px]`}>
            <Slider
              step={1}
              min={0}
              max={100}
              value={[scaleInput]}
              onValueChange={(value) => {
                console.log(value);
                setScaleInput(value[0]);
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
