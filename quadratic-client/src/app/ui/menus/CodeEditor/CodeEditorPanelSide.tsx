import { codeCellIsAConnection } from '@/app/helpers/codeCellLanguage';
import { SchemaViewer } from '@/app/ui/connections/SchemaViewer';
import { AiAssistant } from '@/app/ui/menus/CodeEditor/AiAssistant';
import { Console } from '@/app/ui/menus/CodeEditor/Console';
import { ResizeControl } from '@/app/ui/menus/CodeEditor/ResizeControl';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/shadcn/ui/collapsible';
import { ChevronRightIcon } from '@radix-ui/react-icons';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';

const MIN_HEIGHT_PERCENT = 20;
const MAX_HEIGHT_PERCENT = 80;
const TWO_PANEL_PERCENTS = [50, 50];
const THREE_PANEL_PERCENTS = [34, 33, 33];

interface Props {
  containerRef: React.RefObject<HTMLDivElement>;
}

export function CodeEditorPanelSide(props: Props) {
  const { containerRef } = props;
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const isConnection = codeCellIsAConnection(editorInteractionState.mode);
  const [panelHeightPercentages, setPanelHeightPercentages] = useState(
    isConnection ? TWO_PANEL_PERCENTS : THREE_PANEL_PERCENTS
  );

  // If we're looking at a connection, we have 3 panels, otherwise 2
  useEffect(() => {
    if (isConnection) {
      setPanelHeightPercentages(THREE_PANEL_PERCENTS);
    } else {
      setPanelHeightPercentages(TWO_PANEL_PERCENTS);
    }
  }, [isConnection, setPanelHeightPercentages]);

  return (
    <div className="flex h-full flex-col">
      <PanelBox
        title="Console"
        component={<Console />}
        index={0}
        panelHeightPercentages={panelHeightPercentages}
        setPanelHeightPercentages={setPanelHeightPercentages}
      />

      <ResizeControl
        disabled={panelHeightPercentages[0] === 0 && panelHeightPercentages[1] === 0}
        style={{ position: 'relative' }}
        setState={(mouseEvent) => {
          if (!containerRef.current) return;

          const containerRect = containerRef.current?.getBoundingClientRect();
          console.log(containerRect);
          const newValue = ((mouseEvent.clientY - containerRect.top) / containerRect.height) * 100;
          if (newValue >= MIN_HEIGHT_PERCENT && newValue <= MAX_HEIGHT_PERCENT) {
            setPanelHeightPercentages((prev) => {
              if (isConnection) {
                const whatsLeft = 100 - newValue;
                return [newValue, whatsLeft / 2, whatsLeft / 2];
              } else {
                return [newValue, 100 - newValue];
              }
            });
          }
        }}
        position="HORIZONTAL"
      />
      <PanelBox
        title="AI Assistant"
        component={<AiAssistant />}
        index={1}
        panelHeightPercentages={panelHeightPercentages}
        setPanelHeightPercentages={setPanelHeightPercentages}
      />

      {isConnection && (
        <>
          <ResizeControl
            disabled={panelHeightPercentages[1] === 0 && panelHeightPercentages[2] === 0}
            style={{ position: 'relative' }}
            setState={(mouseEvent) => {
              if (!containerRef.current) return;

              const containerRect = containerRef.current?.getBoundingClientRect();
              const newValue = ((mouseEvent.clientY - containerRect.top) / containerRect.height) * 100;
              if (newValue >= MIN_HEIGHT_PERCENT && newValue <= MAX_HEIGHT_PERCENT) {
                setPanelHeightPercentages((prev) => {
                  const whatsLeft = 100 - newValue;
                  return [newValue / 2, newValue / 2, whatsLeft];
                });
              }
            }}
            position="HORIZONTAL"
          />
          <PanelBox
            title="Data browser"
            component={<SchemaViewer />}
            index={2}
            panelHeightPercentages={panelHeightPercentages}
            setPanelHeightPercentages={setPanelHeightPercentages}
          />
        </>
      )}
    </div>
  );
}

function PanelBox(
  {
    title,
    component,
    panelHeightPercentages,
    index,
    setPanelHeightPercentages,
  }: {
    title: string;
    component: any;
    panelHeightPercentages: number[];
    index: number;
    setPanelHeightPercentages: React.Dispatch<React.SetStateAction<number[]>>;
  } /* TODO: (connections) fix types */
) {
  // const [open, setOpen] = useState<boolean>(true);
  const height = panelHeightPercentages[index];
  const open = height !== 0;
  const setOpen = () => {
    setPanelHeightPercentages((prevState) => {
      const currentHeight = prevState[index];
      if (currentHeight === 0) {
        // Expand
        console.log('EXPAND');
        const panelsAt0 = prevState.filter((val) => val === 0).length;
        // If they're all at 0, set this to 100
        if (panelsAt0 === prevState.length) {
          const next = prevState.map((val, i) => (i === index ? 100 : 0));
          return next;
        }

        const panelsNotAt0 = prevState.filter((val) => val !== 0).length + 1;
        const newValue = 100 / panelsNotAt0;
        const next = prevState.map((val, i) => (i === index ? newValue : val === 0 ? 0 : newValue));
        return next;
      } else {
        // Collapse
        console.log('COLLAPSE');
        const next = getNextState(prevState, index);
        return next;
      }
    });
  };

  return (
    <Collapsible
      className="data-[state=open]:flex-growz flex flex-col"
      style={open ? { height: height + '%' } : {}}
      open={open}
      onOpenChange={setOpen}
    >
      <CollapsibleTrigger className="flex w-full items-center gap-1 bg-background px-2 py-3 text-sm font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-90">
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent className="flex-grow overflow-auto">{component}</CollapsibleContent>
    </Collapsible>
  );
}

/**
 *
 * @param prevState
 * @param index
 * @returns
 */
function getNextState(prevState: number[], index: number) {
  // Iterate through the array (skipping the current index) and find the next value
  let nextValueIndex = null;
  for (let i = 1; i < prevState.length; i++) {
    const currentIndex = (index + i) % prevState.length;
    console.log(currentIndex, prevState[currentIndex]);
    if (prevState[currentIndex] !== 0) {
      nextValueIndex = currentIndex;
      console.log('Value we add:', prevState[currentIndex]);
      break;
    }
  }

  if (nextValueIndex === null) {
    let newValue = [...prevState];
    newValue[index] = 0;
    return newValue;
  } else {
    let valueToAdd = prevState[nextValueIndex];
    const currentValue = prevState[index];
    let newValue = [...prevState];
    newValue[index] = 0;
    newValue[nextValueIndex] = currentValue + valueToAdd;
    return newValue;
  }
}
