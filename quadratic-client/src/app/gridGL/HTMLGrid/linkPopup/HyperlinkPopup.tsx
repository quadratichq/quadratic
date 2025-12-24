import { usePositionCellMessage } from '@/app/gridGL/HTMLGrid/usePositionCellMessage';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Card, CardContent } from '@/shared/shadcn/ui/card';
import { cn } from '@/shared/shadcn/utils';
import { Rectangle } from 'pixi.js';
import { useCallback, useState } from 'react';
import { HyperlinkPopupEdit } from './HyperlinkPopupEdit';
import { HyperlinkPopupView } from './HyperlinkPopupView';
import { useHyperlinkPopup } from './useHyperlinkPopup';

export const HyperlinkPopup = () => {
  const {
    linkData,
    mode,
    editUrl,
    editText,
    pageTitle,
    isVisible,
    hideTextField,
    setEditUrl,
    setEditText,
    handleMouseEnter,
    handleMouseMove,
    handleMouseLeave,
    handleOpenLink,
    handleCopyLink,
    handleEditMode,
    handleRemoveLink,
    handleSaveEdit,
    handleCancelEdit,
    handleKeyDown,
  } = useHyperlinkPopup();

  // Positioning
  const [div, setDiv] = useState<HTMLDivElement | null>(null);
  const ref = useCallback((node: HTMLDivElement) => {
    setDiv(node);
  }, []);

  const offsets = linkData?.rect ?? new Rectangle();
  const { top, left } = usePositionCellMessage({
    div,
    offsets,
    direction: 'vertical',
    autoPosition: true,
  });

  return (
    <Card
      ref={ref}
      className={cn(
        'absolute z-50 min-w-48 max-w-80',
        isVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      )}
      style={{
        top,
        left,
        visibility: isVisible ? 'visible' : 'hidden',
        transition: 'opacity 150ms ease-in-out',
        transformOrigin: '0 0',
        transform: `scale(${1 / pixiApp.viewport.scale.x})`,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <CardContent className="p-3">
        {mode === 'view' ? (
          <HyperlinkPopupView
            url={linkData?.url ?? ''}
            pageTitle={pageTitle}
            onOpen={handleOpenLink}
            onCopy={handleCopyLink}
            onEdit={handleEditMode}
            onRemove={handleRemoveLink}
          />
        ) : (
          <HyperlinkPopupEdit
            editText={editText}
            editUrl={editUrl}
            hideTextField={hideTextField}
            onTextChange={setEditText}
            onUrlChange={setEditUrl}
            onKeyDown={handleKeyDown}
            onSave={handleSaveEdit}
            onCancel={handleCancelEdit}
          />
        )}
      </CardContent>
    </Card>
  );
};
