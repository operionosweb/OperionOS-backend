// services/contractService.js

import supabase from "../config/supabase.js";
import { analyzeContractText } from "./aiExtractionService.js";

/**

* ---
* CREATE CONTRACT
* ---

*/

export async function createContract(contractPayload = {}) {
try {
/**
* Validate input
*/

```
if (!contractPayload?.raw_text) {
  return {
    success: false,
    error: "raw_text is required",
  };
}

/**
 * -----------------------------------------
 * RAW TEXT
 * -----------------------------------------
 */

const rawText =
  contractPayload.raw_text;

/**
 * -----------------------------------------
 * AI ANALYSIS
 * -----------------------------------------
 */

let analysis = {};

/**
 * If analysis already exists
 * from upload pipeline,
 * reuse it.
 */

if (
  contractPayload.analysis
) {
  analysis =
    contractPayload.analysis;
} else {
  analysis =
    await analyzeContractText(
      rawText
    );
}

/**
 * -----------------------------------------
 * INSERT PAYLOAD
 * -----------------------------------------
 */

const insertPayload = {
  /**
   * Core
   */

  name:
    contractPayload.name ||
    "Unnamed Contract",

  supplier_name:
    contractPayload
      ?.supplier_name ||
    analysis
      ?.supplier_name ||
    "Unknown Supplier",

  raw_text: rawText,

  /**
   * Duplicate Intelligence
   */

  document_hash:
    contractPayload.document_hash ||
    null,

  duplicate_of:
    contractPayload.duplicate_of ||
    null,

  is_duplicate:
    contractPayload.is_duplicate ||
    false,

  /**
   * Intelligence
   */

  contract_type:
    contractPayload
      ?.contract_type ||
    analysis
      ?.contract_type ||
    "General Contract",

  summary:
    contractPayload
      ?.summary ||
    analysis?.summary ||
    "",

  clauses:
    contractPayload
      ?.clauses ||
    analysis?.clauses ||
    [],

  obligations:
    contractPayload
      ?.obligations ||
    analysis?.obligations ||
    [],

  risk_score:
    contractPayload
      ?.risk_score ||
    analysis?.risk_score ||
    0,

  /**
   * Commercial
   */

  contract_value:
    contractPayload
      ?.contract_value ||
    analysis
      ?.contract_value ||
    0,

  value:
    contractPayload
      ?.value ||
    analysis
      ?.contract_value ||
    0,

  /**
   * Dates
   */

  start_date:
    contractPayload
      ?.start_date ||
    analysis
      ?.start_date ||
    null,

  expiry_date:
    contractPayload
      ?.expiry_date ||
    analysis
      ?.expiry_date ||
    null,

  /**
   * Metadata
   */

  created_at:
    new Date().toISOString(),
};

/**
 * -----------------------------------------
 * INSERT CONTRACT
 * -----------------------------------------
 */

const {
  data,
  error,
} = await supabase
  .from("contracts")
  .insert(insertPayload)
  .select()
  .single();

if (error) {
  throw error;
}

/**
 * -----------------------------------------
 * RESPONSE
 * -----------------------------------------
 */

return {
  success: true,
  cached: false,
  contract: data,
};
```

} catch (error) {
console.error(
"createContract Error:",
error
);

```
return {
  success: false,
  error:
    error.message ||
    "Failed to create contract",
};
```

}
}

/**

* ---
* GET ALL CONTRACTS
* ---

*/

export async function getAllContracts() {
try {
const {
data,
error,
} = await supabase
.from("contracts")
.select("*")
.order("created_at", {
ascending: false,
});

```
if (error) {
  throw error;
}

return data || [];
```

} catch (error) {
console.error(
"getAllContracts Error:",
error
);

```
return [];
```

}
}

/**

* ---
* GET CONTRACT BY ID
* ---

*/

export async function getContractById(
id
) {
try {
const {
data,
error,
} = await supabase
.from("contracts")
.select("*")
.eq("id", id)
.single();

```
if (error) {
  throw error;
}

return data;
```

} catch (error) {
console.error(
"getContractById Error:",
error
);

```
return null;
```

}
}

/**

* ---
* UPDATE CONTRACT
* ---

*/

export async function updateContract(
id,
updates = {}
) {
try {
const {
data,
error,
} = await supabase
.from("contracts")
.update(updates)
.eq("id", id)
.select()
.single();

```
if (error) {
  throw error;
}

return {
  success: true,
  contract: data,
};
```

} catch (error) {
console.error(
"updateContract Error:",
error
);

```
return {
  success: false,
  error: error.message,
};
```

}
}

/**

* ---
* DELETE CONTRACT
* ---

*/

export async function deleteContract(
id
) {
try {
const { error } =
await supabase
.from("contracts")
.delete()
.eq("id", id);

```
if (error) {
  throw error;
}

return {
  success: true,
};
```

} catch (error) {
console.error(
"deleteContract Error:",
error
);

```
return {
  success: false,
  error: error.message,
};
```

}
}
