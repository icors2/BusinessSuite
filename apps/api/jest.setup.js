process.env.NODE_ENV = 'test';
process.env.SKIP_MASTERDATA_EVENT_LOG = 'true';
process.env.SKIP_SALES_SUBSCRIBER = 'true';
process.env.SKIP_MPS_SUBSCRIBER = 'true';
process.env.SKIP_MES_GATEWAY = 'true';
jest.setTimeout(60000);
