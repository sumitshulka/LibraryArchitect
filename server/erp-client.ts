import { storage } from "./storage";
import type { ErpIntegration, ErpPullEndpoint } from "@shared/schema";

interface ERPTokenResponse {
  access_token?: string;
  token?: string;
  expires_in?: number;
  expiresIn?: number;
}

interface ERPUserDetails {
  registrationNumber?: string;
  rollNumber?: string;
  name: string;
  fatherName?: string;
  dateOfBirth?: string;
  email?: string;
  phone?: string;
  programId?: string;
  programName?: string;
  batchId?: string;
  batchName?: string;
  session?: string;
  academicYear?: string;
  department?: string;
  designation?: string;
  employeeId?: string;
  userType: 'STUDENT' | 'FACULTY' | 'EMPLOYEE';
  [key: string]: any;
}

export class ERPClient {
  private integration: ErpIntegration;

  constructor(integration: ErpIntegration) {
    this.integration = integration;
  }

  private isTokenExpired(): boolean {
    if (!this.integration.cachedAuthToken || !this.integration.cachedAuthTokenExpiresAt) {
      return true;
    }
    const expiresAt = new Date(this.integration.cachedAuthTokenExpiresAt);
    const bufferMs = 60 * 1000;
    return new Date() >= new Date(expiresAt.getTime() - bufferMs);
  }

  async getAuthToken(): Promise<string> {
    if (!this.isTokenExpired() && this.integration.cachedAuthToken) {
      return this.integration.cachedAuthToken;
    }

    if (!this.integration.authLoginUrl) {
      throw new Error("ERP authentication not configured. Please set the login URL.");
    }

    const tokenResponse = await this.fetchNewToken();
    
    const token = tokenResponse.access_token || tokenResponse.token;
    if (!token) {
      throw new Error("Failed to obtain auth token from ERP");
    }

    const ttlSeconds = tokenResponse.expires_in || tokenResponse.expiresIn || this.integration.authTokenTtlSeconds || 3600;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await storage.updateErpIntegrationToken(this.integration.id, token, expiresAt);
    
    this.integration.cachedAuthToken = token;
    this.integration.cachedAuthTokenExpiresAt = expiresAt;

    return token;
  }

  private async fetchNewToken(): Promise<ERPTokenResponse> {
    const loginUrl = this.integration.authLoginUrl!;
    
    const requestBody: Record<string, string> = {};
    if (this.integration.authClientId) {
      requestBody.client_id = this.integration.authClientId;
      requestBody.clientId = this.integration.authClientId;
    }
    if (this.integration.authClientSecret) {
      requestBody.client_secret = this.integration.authClientSecret;
      requestBody.clientSecret = this.integration.authClientSecret;
    }
    requestBody.grant_type = 'client_credentials';

    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ERP authentication failed: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async fetchUserDetails(
    userType: 'STUDENT' | 'FACULTY',
    identifier: string,
    endpoint?: ErpPullEndpoint
  ): Promise<ERPUserDetails | null> {
    if (!this.integration.outboundBaseUrl) {
      throw new Error("ERP outbound base URL not configured");
    }

    const token = await this.getAuthToken();

    let url: string;
    let method = 'GET';
    let body: string | undefined;

    if (endpoint) {
      let urlPath = endpoint.urlPath;
      if (urlPath.includes('{identifier}') || urlPath.includes('{id}')) {
        urlPath = urlPath.replace('{identifier}', identifier).replace('{id}', identifier);
      }
      url = `${this.integration.outboundBaseUrl}${urlPath}`;
      method = endpoint.httpMethod || 'GET';
      
      if (endpoint.requestBodyTemplate && method !== 'GET') {
        const bodyTemplate = typeof endpoint.requestBodyTemplate === 'string' 
          ? endpoint.requestBodyTemplate 
          : JSON.stringify(endpoint.requestBodyTemplate);
        body = bodyTemplate.replace(/{identifier}/g, identifier).replace(/{id}/g, identifier);
      }
    } else {
      const endpointPath = userType === 'STUDENT' 
        ? `/api/students/${identifier}`
        : `/api/faculty/${identifier}`;
      url = `${this.integration.outboundBaseUrl}${endpointPath}`;
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    };

    if (endpoint?.requestHeaders) {
      try {
        const customHeaders = typeof endpoint.requestHeaders === 'string'
          ? JSON.parse(endpoint.requestHeaders)
          : endpoint.requestHeaders;
        Object.assign(headers, customHeaders);
      } catch (e) {
        console.error("Invalid requestHeaders JSON in endpoint configuration:", e);
      }
    }

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body,
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ERP API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (endpoint?.responseRootPath) {
      const paths = endpoint.responseRootPath.split('.');
      let result = data;
      for (const path of paths) {
        result = result?.[path];
      }
      return this.normalizeUserDetails(result, userType);
    }

    return this.normalizeUserDetails(data, userType);
  }

  private normalizeUserDetails(data: any, userType: 'STUDENT' | 'FACULTY'): ERPUserDetails {
    return {
      registrationNumber: data.registrationNumber || data.registration_number || data.regNo || data.id,
      rollNumber: data.rollNumber || data.roll_number || data.rollNo,
      name: data.name || data.fullName || data.full_name || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
      fatherName: data.fatherName || data.father_name || data.fathersName,
      dateOfBirth: data.dateOfBirth || data.date_of_birth || data.dob,
      email: data.email || data.emailId || data.email_id,
      phone: data.phone || data.phoneNumber || data.phone_number || data.mobile,
      programId: data.programId || data.program_id || data.programCode,
      programName: data.programName || data.program_name || data.program,
      batchId: data.batchId || data.batch_id || data.batchCode,
      batchName: data.batchName || data.batch_name || data.batch,
      session: data.session || data.currentSemester || data.semester || data.year,
      academicYear: data.academicYear || data.academic_year,
      department: data.department || data.dept,
      designation: data.designation || data.title,
      employeeId: data.employeeId || data.employee_id || data.empId,
      userType,
      ...data,
    };
  }

  async testConnection(): Promise<{ success: boolean; message: string; tokenObtained?: boolean }> {
    try {
      if (!this.integration.outboundBaseUrl) {
        return { success: false, message: "Outbound base URL not configured" };
      }

      if (this.integration.authLoginUrl) {
        await this.getAuthToken();
        return { success: true, message: "Successfully authenticated with ERP", tokenObtained: true };
      }

      const response = await fetch(`${this.integration.outboundBaseUrl}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      return { 
        success: response.ok, 
        message: response.ok ? "ERP is reachable" : `ERP returned status ${response.status}`,
        tokenObtained: false,
      };
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }
}

export async function getERPClient(integrationId: number): Promise<ERPClient> {
  const integration = await storage.getErpIntegration(integrationId);
  if (!integration) {
    throw new Error("ERP integration not found");
  }
  if (!integration.isActive) {
    throw new Error("ERP integration is not active");
  }
  return new ERPClient(integration);
}

export async function getERPClientByAppId(appId: string): Promise<ERPClient> {
  const integration = await storage.getErpIntegrationByAppId(appId);
  if (!integration) {
    throw new Error("ERP integration not found");
  }
  if (!integration.isActive) {
    throw new Error("ERP integration is not active");
  }
  return new ERPClient(integration);
}
