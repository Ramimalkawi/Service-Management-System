import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TicketCard from "../components/TicketCard";
import TicketDetail from "../components/TicketDetail";
import "../components/TicketCard.css";

// List of available years and their files
const ARCHIVE_FILES_BY_YEAR = {
  2023: ["0007__0606.json", "0607__0906.json", "0906__1205.json"],
  2024: [
    // Add 2024 files here as they become available
  ],
};

const AVAILABLE_YEARS = Object.keys(ARCHIVE_FILES_BY_YEAR);

// Helper to convert legacy numeric date to formatted string
function formatLegacyDate(num) {
  if (typeof num !== "number") return num;
  // The legacy number is seconds since Jan 1, 2000, 00:00:00 UTC
  // 946684800 is the Unix timestamp for 2000-01-01T00:00:00Z
  const unixSeconds = 978307200 + num;
  const date = new Date(unixSeconds * 1000);
  // Format as DD/MM/YYYY, h:mm:ss AM/PM
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

const SEARCH_TYPES = [
  { value: "ticketNum", label: "Ticket Number" },
  { value: "date", label: "Date" },
  { value: "customerName", label: "Customer Name" },
  { value: "serialNum", label: "Device Serial Number" },
  { value: "caseID", label: "Repair ID" },
];

export default function Archived() {
  return <div>Archived tickets page is under maintenance.</div>;
  // const [year, setYear] = useState(AVAILABLE_YEARS[0]);
  // const [tickets, setTickets] = useState([]);
  // const [loading, setLoading] = useState(true);
  // const [error, setError] = useState(null);
  // const [selectedTicketIdx, setSelectedTicketIdx] = useState(null);
  // const [searchQuery, setSearchQuery] = useState("");
  // const [searchType, setSearchType] = useState("ticketNum");
  // const navigate = useNavigate();

  // useEffect(() => {
  //   async function fetchTickets() {
  //     setLoading(true);
  //     setError(null);
  //     setSelectedTicketIdx(null);
  //     try {
  //       const allTickets = [];
  //       const files = ARCHIVE_FILES_BY_YEAR[year] || [];
  //       for (const file of files) {
  //         const res = await fetch(`/archived-tickets/${year}/${file}`);
  //         if (!res.ok) throw new Error(`Failed to fetch ${file}`);
  //         const data = await res.json();
  //         if (Array.isArray(data.tickets)) {
  //           // Normalize ticketNum
  //           allTickets.push(
  //             ...data.tickets.map((t) => ({
  //               ...t,
  //               ticketNum: t.ticketNum !== undefined ? t.ticketNum : t.number,
  //             }))
  //           );
  //         }
  //       }
  //       setTickets(allTickets);
  //     } catch (err) {
  //       setError(err.message);
  //     } finally {
  //       setLoading(false);
  //     }
  //   }
  //   fetchTickets();
  // }, [year]);

  // // Filtered tickets based on search
  // const filteredTickets = tickets.filter((ticket) => {
  //   if (!searchQuery.trim()) return true;
  //   const query = searchQuery.toLowerCase();
  //   switch (searchType) {
  //     case "ticketNum": {
  //       const num = String(ticket.ticketNum || ticket.number || "");
  //       return num.toLowerCase().includes(query);
  //     }
  //     case "date":
  //       return (
  //         (ticket.date && String(ticket.date).toLowerCase().includes(query)) ||
  //         false
  //       );
  //     case "customerName":
  //       return (
  //         (ticket.customerName &&
  //           ticket.customerName.toLowerCase().includes(query)) ||
  //         false
  //       );
  //     case "serialNum":
  //       return (
  //         (ticket.serialNum &&
  //           ticket.serialNum.toLowerCase().includes(query)) ||
  //         false
  //       );
  //     case "caseID":
  //       return (
  //         (ticket.caseID && ticket.caseID.toLowerCase().includes(query)) ||
  //         false
  //       );
  //     default:
  //       return true;
  //   }
  // });

  // if (loading) return <div>Loading archived tickets...</div>;
  // if (error) return <div style={{ color: "red" }}>Error: {error}</div>;

  // return (
  //   <div>
  //     <div
  //       style={{
  //         marginBottom: 16,
  //         display: "flex",
  //         alignItems: "center",
  //         gap: 16,
  //       }}
  //     >
  //       <label htmlFor="archived-year-select" style={{ marginRight: 8 }}>
  //         Select Year:
  //       </label>
  //       <select
  //         id="archived-year-select"
  //         value={year}
  //         onChange={(e) => setYear(e.target.value)}
  //       >
  //         {AVAILABLE_YEARS.map((y) => (
  //           <option key={y} value={y}>
  //             {y}
  //           </option>
  //         ))}
  //       </select>
  //       <input
  //         type="text"
  //         placeholder={`Search by ${SEARCH_TYPES.find((t) => t.value === searchType).label}...`}
  //         value={searchQuery}
  //         onChange={(e) => setSearchQuery(e.target.value)}
  //         style={{ marginLeft: 8, padding: 4, minWidth: 180 }}
  //       />
  //       <select
  //         value={searchType}
  //         onChange={(e) => {
  //           setSearchType(e.target.value);
  //           setSearchQuery("");
  //         }}
  //         style={{ marginLeft: 8 }}
  //       >
  //         {SEARCH_TYPES.map((type) => (
  //           <option key={type.value} value={type.value}>
  //             {type.label}
  //           </option>
  //         ))}
  //       </select>
  //     </div>
  //     <div style={{ margin: "0 auto" }}>
  //       {filteredTickets.length === 0 ? (
  //         <p>No archived tickets found for {year}.</p>
  //       ) : (
  //         <div style={{ display: "flex", gap: 24 }}>
  //           <div
  //             style={{
  //               maxHeight: 1000,
  //               overflowY: "auto",
  //               flex: selectedTicketIdx === null ? 1 : 1,
  //               width: selectedTicketIdx === null ? "100%" : undefined,
  //               transition: "width 0.2s",
  //             }}
  //           >
  //             {filteredTickets.map((ticket, idx) => (
  //               <TicketCard
  //                 key={`${ticket.id || "noid"}_${idx}`}
  //                 ticket={{ ...ticket, date: formatLegacyDate(ticket.date) }}
  //                 isSelected={selectedTicketIdx === idx}
  //                 onClick={() => setSelectedTicketIdx(idx)}
  //               />
  //             ))}
  //           </div>
  //           {selectedTicketIdx !== null &&
  //             filteredTickets[selectedTicketIdx] && (
  //               <div style={{ flex: 1, minWidth: 0, maxHeight: 1000 }}>
  //                 <TicketDetail
  //                   ticket={{
  //                     ...filteredTickets[selectedTicketIdx],
  //                     date: formatLegacyDate(
  //                       filteredTickets[selectedTicketIdx].date
  //                     ),
  //                   }}
  //                   onClose={() => setSelectedTicketIdx(null)}
  //                   archived={true}
  //                 />
  //               </div>
  //             )}
  //         </div>
  //       )}
  //     </div>
  //   </div>
  // );
}
