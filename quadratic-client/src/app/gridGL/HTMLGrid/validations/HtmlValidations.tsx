import { HtmlValidationList } from './HtmlValidationList';
import { HtmlValidationMessage } from './HtmlValidationMessage';
import { useHtmlValidations } from './useHtmlValidations';

export const HtmlValidations = () => {
  const htmlValidationsData = useHtmlValidations();
  const { validation, offsets } = htmlValidationsData;

  if (!validation || !offsets) return null;

  return (
    <>
      <HtmlValidationList htmlValidationsData={htmlValidationsData} />
      <HtmlValidationMessage htmlValidationsData={htmlValidationsData} />
    </>
  );
};
