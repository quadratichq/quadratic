import { ValidationStyle } from '@/app/quadratic-core-types';
import { ValidationData } from './useValidationData';
import { ValidationUICheckbox, ValidationDropdown, ValidationInput, ValidationTextArea } from './ValidationUI';

interface Props {
  validationData: ValidationData;
}

const STYLE_OPTIONS: { label: string; value: ValidationStyle }[] = [
  { label: 'Stop', value: 'Stop' },
  { label: 'Warning', value: 'Warning' },
  { label: 'Information', value: 'Information' },
];

export const ValidationMessage = (props: Props) => {
  const { rule, validation, setValidation } = props.validationData;

  const changeMessageTitle = (title: string) => {
    setValidation((old) => {
      if (old) {
        return { ...old, message: { ...old.message, title } };
      }
    });
  };

  const changeMessageMessage = (message: string) => {
    setValidation((old) => {
      if (old) {
        return { ...old, message: { ...old.message, message } };
      }
    });
  };

  const changeErrorStyle = (style: ValidationStyle) => {
    setValidation((old) => {
      if (old) {
        return { ...old, error: { ...old.error, style } };
      }
    });
  };

  const changeErrorTitle = (title: string) => {
    setValidation((old) => {
      if (old) {
        return { ...old, error: { ...old.error, title } };
      }
    });
  };

  const changeErrorMessage = (message: string) => {
    setValidation((old) => {
      if (old) {
        return { ...old, error: { ...old.error, message } };
      }
    });
  };

  const showMessage = (checked: boolean) => {
    setValidation((old) => {
      if (old) {
        return { ...old, message: { ...old.message, show: checked } };
      }
    });
  };

  const showError = (checked: boolean) => {
    setValidation((old) => {
      if (old) {
        return { ...old, error: { ...old.error, show: checked } };
      }
    });
  };

  if (rule === 'none') return null;

  return (
    <>
      <div className="border-t border-t-gray-100 pt-4 font-medium">Input Message</div>
      <div className="flex flex-col gap-5">
        <ValidationUICheckbox
          label="Show input message when cell is selected"
          showDropdown={!!validation?.message.show}
          changeDropDown={showMessage}
        />
        <ValidationInput
          label="Title"
          value={validation?.message.title || ''}
          onChange={(title) => changeMessageTitle(title)}
        />
        <ValidationTextArea
          label="Message"
          value={validation?.message.message || ''}
          onChange={(message) => changeMessageMessage(message)}
          height="10rem"
        />
      </div>
      <div className="border-t border-t-gray-100 pt-4 font-medium">Error Message</div>
      <ValidationUICheckbox
        label="Show error alert after invalid data"
        showDropdown={!!validation?.error.show}
        changeDropDown={showError}
      />
      <ValidationDropdown
        label="Style"
        value={validation?.error.style || 'Stop'}
        onChange={(style) => changeErrorStyle(style as ValidationStyle)}
        options={STYLE_OPTIONS}
      />
      <ValidationInput
        label="Title"
        value={validation?.error.title || ''}
        onChange={(title) => changeErrorTitle(title)}
      />
      <ValidationTextArea
        label="Message"
        value={validation?.error.message || ''}
        onChange={(message) => changeErrorMessage(message)}
        height="10rem"
      />
    </>
  );
};