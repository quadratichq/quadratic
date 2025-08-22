import { HtmlValidationCheckbox } from '@/app/gridGL/HTMLGrid/validations/HtmlValidationCheckbox';
import { HtmlValidationList } from '@/app/gridGL/HTMLGrid/validations/HtmlValidationList';
import { HtmlValidationMessage } from '@/app/gridGL/HTMLGrid/validations/HtmlValidationMessage';
import { useHtmlValidations } from '@/app/gridGL/HTMLGrid/validations/useHtmlValidations';

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
