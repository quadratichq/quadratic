
## Random Features I think would be good for this application
- [x] Live Cells: they update every 1 seconds (refetch API data, think live stock data, have not implimented picking a time)
- [x] Cyclic Cell Detection and handling: excel gives you are error, currently is a bug in your code, it should be a feature! (where you pick how fast it updates) Right now if you set a python script return value = 1, and the save, and then change the value to be value = c(self) + 1 and save, it will run very fast and then eventually become buggy. With this cyclic loops are detected and only run once each time any cell is called, starting with the called cell through the cycle up to (not including) the called cell.  There is a an example file outlining this, it even has a newtons method in there :) (proabably doesn't work for weird cyclic graphs)
- [ ] Vector Cells (or Python Object Cells): would make working with python easier
- [ ] UI in Cells: buttons, checkboxes, etc.. For changing logic in the sheet or running parts of the code you don't want to auto-update
- [ ] Exportable Application: Export sheet as a non-editable application. People at work can make complicated data-analysis tools and give them to their co-workers who just need to know how to fill it out, press buttons, etc. 
- [ ] Exportable Command Line Script: Export sheet as a compiled executable for data scientist. This is just practical for anyone that currently only uses code to do their work.


