import { usePositionCellMessage } from '@/app/gridGL/HTMLGrid/usePositionCellMessage';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
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
    setPopupRef,
    setEditUrl,
    setEditText,
    handleMouseEnter,
    handleMouseMove,
    handleMouseLeave,
    handleBlur,
    handleWheel,
    handleOpenLink,
    handleCopyLink,
    handleEditMode,
    handleRemoveLink,
    handleSaveEdit,
    handleCancelEdit,
    handleKeyDown,
    handleKeyUp,
  } = useHyperlinkPopup();

  // Positioning
  const [div, setDiv] = useState<HTMLDivElement | null>(null);
  const ref = useCallback(
    (node: HTMLDivElement) => {
      setDiv(node);
      setPopupRef(node);
    },
    [setPopupRef]
  );

  const offsets = linkData?.rect ?? new Rectangle();
  const { top, left } = usePositionCellMessage({
    div,
    offsets,
    direction: 'vertical',
    autoPosition: true,
  });

  // Prevent keyboard events from reaching the grid (safety net for any events that bubble up)
  const handleKeyDownWrapper = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  const handleKeyUpWrapper = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        'absolute z-50 rounded-md border bg-popover p-3 text-popover-foreground shadow-md outline-none transition-opacity duration-150 ease-in-out',
        isVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        mode === 'edit' ? 'w-80' : 'min-w-48 max-w-80'
      )}
      style={{
        top,
        left,
        transformOrigin: '0 0',
        transform: `scale(${1 / pixiApp.viewport.scale.x})`,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
      onKeyDown={handleKeyDownWrapper}
      onKeyUp={handleKeyUpWrapper}
      onBlur={handleBlur}
    >
      {mode === 'view' ? (
        <HyperlinkPopupView
          url={linkData?.url ?? ''}
          linkTitle={pageTitle || linkData?.linkText}
          isFormula={linkData?.isFormula ?? false}
          isNakedUrl={linkData?.isNakedUrl ?? false}
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
          onKeyUp={handleKeyUp}
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
        />
      )}
    </div>
  );
};
