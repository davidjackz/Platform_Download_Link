const axios = require("axios");

let runtimeBakongApiToken = "";

function getBakongApiBaseUrl() {
  return (process.env.BAKONG_API_BASE_URL || "https://api-bakong.nbc.gov.kh").replace(/\/+$/, "");
}

function getBakongApiEmail() {
  return process.env.BAKONG_API_EMAIL || "";
}

function getBakongApiToken() {
  return runtimeBakongApiToken || process.env.BAKONG_API_TOKEN || "";
}

class BakongApiError extends Error {
  constructor(message, code = "BAKONG_API_ERROR", details = null) {
    super(message);
    this.name = "BakongApiError";
    this.code = code;
    this.details = details;
  }
}

function isBakongVerificationConfigured() {
  return Boolean(getBakongApiToken() || getBakongApiEmail());
}

function setRuntimeBakongApiToken(token) {
  runtimeBakongApiToken = token || "";
  return runtimeBakongApiToken;
}

function isUnauthorizedResponse(error) {
  if (!error?.response) {
    return false;
  }

  return (
    error.response.status === 401 ||
    error.response.data?.errorCode === 6 ||
    /unauthorized/i.test(error.response.data?.responseMessage || "")
  );
}

async function renewBakongApiToken() {
  const email = getBakongApiEmail();

  if (!email) {
    throw new BakongApiError("Bakong API email is missing.", "MISSING_EMAIL");
  }

  try {
    const response = await axios.post(
      `${getBakongApiBaseUrl()}/v1/renew_token`,
      { email },
      {
        timeout: 15000,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const token = response.data?.data?.token;

    if (response.data?.responseCode === 0 && token) {
      return setRuntimeBakongApiToken(token);
    }

    throw new BakongApiError(
      response.data?.responseMessage || "Unable to renew Bakong API token.",
      "TOKEN_RENEW_FAILED",
      { data: response.data }
    );
  } catch (error) {
    if (error instanceof BakongApiError) {
      throw error;
    }

    if (isUnauthorizedResponse(error)) {
      throw new BakongApiError(
        error.response?.data?.responseMessage || "Bakong API token is invalid or expired.",
        "UNAUTHORIZED",
        {
          status: error.response?.status,
          data: error.response?.data,
        }
      );
    }

    if (error.response) {
      throw new BakongApiError(
        error.response.data?.responseMessage || "Unable to renew Bakong API token.",
        "TOKEN_RENEW_FAILED",
        {
          status: error.response.status,
          data: error.response.data,
        }
      );
    }

    throw new BakongApiError(
      error.message || "Unable to connect to Bakong API.",
      "NETWORK_ERROR"
    );
  }
}

async function checkTransactionStatusByMd5(md5, options = {}) {
  const { allowRenew = true } = options;
  const bakongApiToken = getBakongApiToken();

  if (!bakongApiToken) {
    if (allowRenew && getBakongApiEmail()) {
      await renewBakongApiToken();
      return checkTransactionStatusByMd5(md5, { allowRenew: false });
    }

    throw new BakongApiError("Bakong API token is missing.", "MISSING_TOKEN");
  }

  try {
    const response = await axios.post(
      `${getBakongApiBaseUrl()}/v1/check_transaction_by_md5`,
      { md5 },
      {
        timeout: 15000,
        headers: {
          Authorization: `Bearer ${bakongApiToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    if (isUnauthorizedResponse(error)) {
      if (allowRenew && getBakongApiEmail()) {
        await renewBakongApiToken();
        return checkTransactionStatusByMd5(md5, { allowRenew: false });
      }

      throw new BakongApiError(
        error.response?.data?.responseMessage || "Bakong API token is invalid or expired.",
        "UNAUTHORIZED",
        {
          status: error.response?.status,
          data: error.response?.data,
        }
      );
    }

    if (error.response) {
      throw new BakongApiError(
        error.response.data?.responseMessage || "Bakong API request failed.",
        "HTTP_ERROR",
        {
          status: error.response.status,
          data: error.response.data,
        }
      );
    }

    throw new BakongApiError(
      error.message || "Unable to connect to Bakong API.",
      "NETWORK_ERROR"
    );
  }
}

function classifyTransactionStatus(payload = {}) {
  if (payload.responseCode === 0 && payload.data?.hash) {
    return {
      state: "success",
      transaction: payload.data,
    };
  }

  if (payload.responseCode === 1 && payload.errorCode === 1) {
    return {
      state: "pending",
      transaction: null,
    };
  }

  if (payload.responseCode === 1 && payload.errorCode === 3) {
    return {
      state: "failed",
      transaction: null,
    };
  }

  if (payload.responseCode === 1 && payload.errorCode === 2) {
    return {
      state: "unsupported",
      transaction: null,
    };
  }

  return {
    state: "error",
    transaction: null,
  };
}

module.exports = {
  getBakongApiBaseUrl,
  getBakongApiEmail,
  getBakongApiToken,
  BakongApiError,
  isBakongVerificationConfigured,
  renewBakongApiToken,
  checkTransactionStatusByMd5,
  classifyTransactionStatus,
};
