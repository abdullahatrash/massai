TF – BLOCKCHAIN DOCUMENTATION
Version: 1.0
Date: 17 February 2025
Period Covered: October 2024 – February 2025

Executive Summary
Project Overview
The MaaSAI project aims to create a comprehensive digital system to automate and facilitate interactions between suppliers of manufacturing systems (Providers) and manufacturing companies (Consumers) in a Manufacturing-as-a-Service (MaaS) ecosystem, in an agile, efficient and transparent manner. In the context of this project, we will develop the blockchain integration as well as smart contracts for the ecosystem.
Key Achievements in MVP Phase
During this phase we have achieved multiple primary goals. We have successfully developed and are currently hosting our own private blockchain network. Additionally, we have created a first version of the smart contracts toolkit that implements the initial business workflow we designed

Business Perspective
Use Case & Business Workflow
Scenario
The initial business use case we designed relates to one of the pilots of the project. Specifically, the food production company Barba Stathis. Blockchain technology will enhance transparency and traceability in Barba Stathis production lines, ensuring secure transactions and interoperable data exchange. Towards that end we designed a simple workflow in which the use of blockchain in BS’s production line will be demonstrated.
The use case is as follows:
A user makes an order of a product
Barba Stathis’ warehouse checks if it has enough stock
If not, the order is on hold until the warehouse is restocked
The products for the order are then collected and dispatched
Finally, the order is delivered and registered as complete
Below we can see the flowchart of this workflow:
For the workflow to run smoothly, we developed several roles for users each with their own privileges.
Administrator: this role represents an official from Barba Stathis’ IT department or upper management. The user(s) with this role can make function calls of all the implemented functions. They can also modify any orders placed, as well as alter the contents of the “Warehouse” object. They can also grant or revoke other role privileges to other users. Finally, an admin can promote another user to admin, but this process cannot be reverted and should be used with caution.
Client: this role represents a client of Barba Stathis, logging an order of vegetables or other associated products. A client can only log in new orders as well as view any orders previously logged on the network.
Warehouse Manager (Provider): this role represents the manager or official that oversees the warehouse of barba Stathis. This role can view orders, as well as facilitate the warehouse stock check before proceeding to dispatch. They also update the blockchain when the warehouse is restocked.
Delivery Responsible: this role represents the official that oversees the delivery of a certain order. They can update a package’s location and status.
Assumptions and limitations
Currently, the warehouse checks as well as dispatch are simplified. Most notably, the is one master warehouse instead of several smaller storage spaces. The entire production process is oversimplified into “add more items to the store”. This can potentially be updated based on the preferences of the project pilots.
Business Benefits & Value Proposition
How the MVP adds value to the business
Expected impact on efficiency, transparency, and security
Comparison with traditional methods (if applicable)
TO DO
technical Architecture & Implementation
System Architecture Overview
Blockchain Layer
Blockchain consists of several key components that work together to ensure its functionality, security, and decentralization. A blockchain is a decentralized ledger that records all transactions across multiple nodes (computers) in a peer-to-peer (P2P) network. This ensures transparency and prevents a single point of failure. Transactions are recorded in the blockchain and verified by nodes before being included in a block. Once confirmed, transactions become immutable and cannot be altered. Some blockchains, like Ethereum, include a Blockchain Virtual Machine (e.g., Ethereum Virtual Machine - EVM) that executes smart contracts and supports decentralized applications. To validate and add new transactions, blockchain networks use consensus mechanisms such as Proof of Work or Proof of Stake.
 To run the network a blockchain client is required. The network must expose APIs for dApps & scripts to interact with the blockchain. Specifically, HTTP RCP is used by wallets, explorers and backend services. Optionally, block explorers can be used to visualize transactions and block activities.
Smart Contract Layer
Smart Contracts are self-executing programs stored on the blockchain that automatically enforce agreements when conditions are met. Ethereum popularized smart contracts, enabling decentralized applications (dApps). Smart Contracts were developed using Solidity. Our contacts were developed based on the scenarios defined in the use case. After bringing developed and compiled these smart contracts were deployed on the blockchain, thus enabling users to interact with each one.
[Possible Insert an architecture diagram here showcasing how different components interact, including the blockchain, smart contracts etc.]
Blockchain Infrastructure & Deployment

SLG’s Blockchain Network (SBN) is hosted on a private virtual machine (VM) with a private IP address belonging to SLG’s network (174.31.154.43). This renders our network inaccessible to individuals without access to the VM.
To address the needs of the MaaSAI project, several considerations were made. The system required programmability to support smart contracts, enabling automation and logic within the blockchain. A private network was essential for controlled access, ensuring the security and confidentiality of transactions. Additionally, a virtual wallet was necessary to facilitate seamless transactions between users. The choice of a consensus mechanism fell on Proof of Authority (PoA), as it is faster, more efficient, and particularly well-suited for small-scale scenarios. Furthermore, the ability to monitor transactions and contract calls within the blockchain network was identified as a critical need.
For the technologies selected, Ethereum emerged as the preferred choice due to its robust programmability and strong community support, making it an ideal platform for the implementation of smart contracts. The MetaΜask wallet was chosen to provide users with an intuitive interface for interacting with the blockchain and conducting transactions.
The Hyperledger Besu client was utilized as the blockchain client, owing to its flexibility in supporting custom consensus mechanisms, including Proof of Authority. Lastly, BlockScout was implemented as the blockchain explorer, offering compatibility with the Besu client and enabling the team to monitor blockchain activity effectively.
These technologies were deployed using the Quorum Dev Quickstart (https://github.com/ConsenSys/quorum-dev-quickstart) Package. Specifically, we utilized the package’s docker-based setup to efficiently host a blockchain network.
Finally, using a nginx reverse proxy as well as Cloudflare for DNS, we made some addresses publicly available. Specifically, the following:
RCP URL: https://entrynet-maasai.euinno.eu 
Blockscout: https://blockscout-maasai.euinno.eu 
Quorum Explorer: https://explorer-maasai.euinno.eu
The first one, represents the RCP node. RPC (Remote Procedure Call) is a protocol used to communicate with blockchain nodes. It allows users or applications to interact with a blockchain network by invoking functions or retrieving data from the node. It is necessary to connect to the blockchain network. The other two serve as block explorers.
Instructions for connecting to the SBN: Instructions on how to install MetaMask.pdf
Chosen Blockchain & Tools
A table could be included here as well for quick reference:


Smart Contract Structure & Logic
Contracts Overview
Role Management Contract
Purpose: This contract defines the user roles available in our dApp. The user that publishes this contract to the blockchain is immediately granted the “admin” role. This contract also contains functions that grant or revoke role rights to other users. A simple user is by default a “client”.
Order Management Contract
Purpose: This contract implements the logging of new orders by the user. All the orders are stored in the blockchain’s memory. Each order is assigned its own unique id. Additionally, functions are included that can edit the details of a single order, however they are only restricted to an admin.
Warehouse Management Contract
Purpose: This contract represents the storage and or warehouse of a production company. It has functions that facilitate the warehouse’s restock. It also checks whether the warehouse’s supply is adequate for an order’s requirements or if further stock is needed. If it is adequate, then the order is packaged. For functions to be called a user must either be an “admin” or a “warehouse manager”
Delivery Management Contract
Purpose: This contract handles the final stage of the order process, the delivery. It has functions that handle the next steps of the delivery until a package arrives to its destination. The corresponding order is then marked as complete. In order for functions to be called a user must either be an “admin” or a “delivery responsible”
Contract Inheritance & Interactions

In Solidity, contract inheritance allows one contract to inherit the properties and functions of another contract. This follows the object-oriented programming (OOP) principle of reusability, reducing redundancy and improving code organization. A child inherits its parent contract, meaning it has access to all previously declared functions and variables.
Sequence Diagrams – Transaction Flow


Smart Contract Deployment


Deployment Process
Steps to deploy contracts
Network details 
How to verify deployment using BlockScout
Etc….





Technical Challenges & Solutions


Future Development & Next Steps

Enhancements for Next Phase

Roadmap & Timeline


References
GitHub repository: [Insert Link]
Deployment instructions: [Insert Link]
API documentation: [Insert Link]
