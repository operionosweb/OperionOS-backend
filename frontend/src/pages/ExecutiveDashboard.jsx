export default function OperionExecutiveDashboard() {

  const fleet = [
    {
      id: "A320-NEO-01",
      health: 82,
      risk: "LOW",
      recommendation: "KEEP",
      transition: "READY",
      stress: "STABLE",
      leaseExposure: "$1.2M"
    },
    {
      id: "B737-800-14",
      health: 58,
      risk: "MEDIUM",
      recommendation: "MONITOR",
      transition: "DELAYED",
      stress: "UNDER_PRESSURE",
      leaseExposure: "$3.8M"
    },
    {
      id: "A330-300-07",
      health: 34,
      risk: "HIGH",
      recommendation: "RESTRUCTURE",
      transition: "HIGH_RISK",
      stress: "DISTRESSED",
      leaseExposure: "$9.4M"
    }
  ];

  const recommendations = [
    "Delay heavy maintenance on A330-300-07 until lease renegotiation completes",
    "Increase reserve liquidity buffer by 18% over next 2 quarters",
    "Reposition B737-800-14 into higher utilization route network",
    "Reduce transition exposure on aging narrowbody fleet"
  ];

  const riskCards = [
    {
      title: "Fleet Health Score",
      value: "71/100",
      subtitle: "+4 this quarter"
    },
    {
      title: "Financial Stress",
      value: "Moderate",
      subtitle: "Fuel + FX pressure detected"
    },
    {
      title: "Transition Exposure",
      value: "$12.8M",
      subtitle: "Across 6 aircraft"
    },
    {
      title: "Maintenance Reserve Risk",
      value: "High",
      subtitle: "2 aircraft underfunded"
    }
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6">

      <div className="max-w-7xl mx-auto
