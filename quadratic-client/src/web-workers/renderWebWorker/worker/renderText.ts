class RenderText {
  private sheetIds: string[] = [];

  setSheetIds(sheetIds: string[]) {
    this.sheetIds = sheetIds;
  }
}

export const renderText = new RenderText();
