import { HtmlValidationList } from './HtmlValidationList';
import { HtmlValidationMessage } from './HtmlValidationMessage';
import { useHtmlValidations } from './useHtmlValidations';

export const HtmlValidations = () => {
  const htmlValidationsData = useHtmlValidations();

  return (
    <>
      <HtmlValidationList htmlValidationsData={htmlValidationsData} />
      <HtmlValidationMessage htmlValidationsData={htmlValidationsData} />
    </>
  );
};
