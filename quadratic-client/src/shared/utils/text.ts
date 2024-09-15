export const joinWithOr = (arr: any[]): string => {
  if (arr.length === 1) {
    return arr[0];
  }

  return `${arr.slice(0, -1).join(', ')} or ${arr[arr.length - 1]}`;
};
