export const ValidationDocs = `
# Validations

## Overview

Validations are used to both verify that cells have allowable data, and to provide messages to the user when they enter a cell.

## How validations are stored

Validations are set per sheet so you cannot add a selection from another sheet to a validation in a different sheet.

## One validation per cell

Each cell can only have one validation. If you add a validation to a range then any validations that overlap with the new validation will be removed. The algorithm either changes the selection to remove the overlap, or, if the selection becomes empty, removes the validation.

## Messages and errors

Adding a message to validations will show the message when the user enters the cell with the cursor. An error will show when the user either enters the cell or hovers over it with the cursor.

## Purpose of validations

You can use validations to create checkboxes and dropdown lists, as well as to add messages or errors to the user when they enter a cell. They make the user experience more interactive and engaging.`;
