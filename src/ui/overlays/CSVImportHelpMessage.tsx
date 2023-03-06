import { useRecoilState } from 'recoil';
import { showCSVImportHelpAtom } from '../../atoms/showCSVImportHelpAtom';
import { QuadraticSnackBar } from '../components/QuadraticSnackBar';

export const CSVImportHelpMessage = () => {
  const [show, setShow] = useRecoilState(showCSVImportHelpAtom);

  return (
    <QuadraticSnackBar
      open={show}
      onClose={() => {
        setShow(false);
      }}
      message="Drag and drop a CSV file on the grid to import it."
    />
  );
};
