import { HtmlValidationCheckbox } from './HtmlValidationCheckbox';
import { HtmlValidationList } from './HtmlValidationList';
import { HtmlValidationMessage } from './HtmlValidationMessage';
import { useHtmlValidations } from './useHtmlValidations';

export const HtmlValidations = () => {
  const htmlValidationsData = useHtmlValidations();

  const { location, offsets, validation } = htmlValidationsData;

  return (
    <>
      <HtmlValidationList htmlValidationsData={htmlValidationsData} />
      <HtmlValidationCheckbox htmlValidationsData={htmlValidationsData} />
      <HtmlValidationMessage column={location?.x} row={location?.y} offsets={offsets} validation={validation} />
    </>
  );
};
