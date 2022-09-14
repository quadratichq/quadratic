const isAlphaNumeric = (char: string): boolean => {
  const key = char.toLowerCase();

  if (key.length !== 1) {
    return false;
  }
  const isLetter = key >= 'a' && key <= 'z';
  const isNumber = key >= '0' && key <= '9';
  if (isLetter || isNumber) {
    return true;
  } else {
    return false;
  }
};

export default isAlphaNumeric;
