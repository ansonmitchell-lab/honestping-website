# Shared traces and private addresses

This note is for Legal and the privacy policy. It describes the ISP preview that maps a traceroute to the provider's own nodes. It is not a public page.

## A trace is stored only when the customer shares it

HonestPing does not send a traceroute on its own. A trace is stored only when the customer chooses to share a 7-day report and the trace is attached to that share. There is no background telemetry. The customer report is a 7-day report.

## The device scan never leaves the PC

The scan of devices on the home network stays on the PC. HonestPing does not store device lists, MAC addresses, home LAN addresses, the customer's own address, Wi-Fi names, or personal names. The share carries a short home summary: link type, a coarse Wi-Fi signal word, gateway health, and similar counts. It does not name people or devices.

The address of the computer that uploads a share is not stored.

## Home hops are always redacted

The customer's own router, and every hop before it, is stored without an address. If a share arrives with an address still on those hops, the server removes the address before saving and writes a warning. The warning names the hop number, not the address.

## Provider addresses after the router

Some providers number their own routers from private ranges or from the shared CGNAT range. Those hops come after the customer's router. They are kept and marked ISP private so the provider can map them to a node. An emergency switch, KEEP_ISP_PRIVATE_HOPS, can turn that off. It defaults to on. Home hops stay redacted either way.

## Who can see an address

ISP private addresses are visible only to the provider org that received the share. Another provider cannot read them. A public page does not return them. A total across providers does not include them. The owner dashboard can see how many shares exist, and does not see hop addresses.

Public name and routing lookups run only for public hop addresses. Provider private addresses are not sent to those lookups. Results are cached for 7 days.

## Group size

Area counts, node alerts, and node suggestions use one minimum, K_MIN. The default is 10 households. The owner has not decided the final value. A household counts once in a group. A group under the minimum is hidden, and the smaller number is not shown.

## HonestPing does not sell data

HonestPing does not sell data. Area trends are not for sale. That decision is pending.

## Example preview

The ISP screens in this preview show example traces, labeled Example. They are for review of the layout and the rules above. A stored share is still limited to the provider that received it, even when the example screens do not draw it.
