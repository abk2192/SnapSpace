import { store } from '../core/Store.js';

export class EditorVM {
    generateTableHtml(rows, cols) {
        let html = '<table class="evidence-table"><tbody>';
        for (let r = 0; r < rows; r++) {
            html += '<tr>';
            for (let c = 0; c < cols; c++) {
                html += '<td><br></td>'; // <br> ensures cell is clickable and editable
            }
            html += '</tr>';
        }
        html += '</tbody></table><br>'; // trailing break to escape the table
        return html;
    }
}