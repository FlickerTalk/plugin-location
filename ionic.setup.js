import { initialize } from "@ionic/core/components";
import { defineCustomElement as button } from "@ionic/core/components/ion-button.js";
import { defineCustomElement as content } from "@ionic/core/components/ion-content.js";
import { defineCustomElement as icon } from "@ionic/core/components/ion-icon.js";
import { defineCustomElement as spinner } from "@ionic/core/components/ion-spinner.js";

initialize();
for (const define of [button, content, icon, spinner]) define();
