const config = {
  // Summary was renamed to Reports.
  async redirects() {
    return [{ source: "/summary", destination: "/reports", permanent: true }];
  },
};

export default config;
