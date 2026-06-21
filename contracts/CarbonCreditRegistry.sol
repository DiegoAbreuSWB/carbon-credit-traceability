// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CarbonCreditRegistry
 * @notice Protótipo acadêmico para rastreabilidade de créditos de carbono.
 *         Dados são simulados para fins de pesquisa de Iniciação Científica.
 */
contract CarbonCreditRegistry {
    // -------------------------------------------------------------------------
    // Tipos e enumerações
    // -------------------------------------------------------------------------

    enum CreditStatus {
        Created,     // 0 – Crédito emitido, aguardando validação
        Validated,   // 1 – Crédito validado por entidade certificadora
        Transferred, // 2 – Crédito transferido para novo proprietário
        Retired,     // 3 – Crédito aposentado (usado/compensado)
        Rejected     // 4 – Crédito rejeitado pelo validador
    }

    struct CarbonCredit {
        uint256 id;
        string areaName;
        string location;        // Município/Estado
        string geoCoordinates;  // Coordenadas ou geohash simulado
        uint256 co2Tonnes;      // CO2 equivalente em toneladas
        address issuer;
        address owner;
        address validator;
        uint256 issuedAt;
        CreditStatus status;
    }

    struct CreditEvent {
        uint256 creditId;
        string eventType;
        address actor;
        uint256 timestamp;
        string metadata;
    }

    // -------------------------------------------------------------------------
    // Estado
    // -------------------------------------------------------------------------

    uint256 private _nextCreditId;
    mapping(uint256 => CarbonCredit) private _credits;
    uint256[] private _creditIds;

    CreditEvent[] private _auditLog;

    // -------------------------------------------------------------------------
    // Eventos
    // -------------------------------------------------------------------------

    event CreditIssued(
        uint256 indexed creditId,
        address indexed issuer,
        string areaName,
        uint256 co2Tonnes,
        uint256 timestamp
    );

    event CreditValidated(
        uint256 indexed creditId,
        address indexed validator,
        uint256 timestamp
    );

    event CreditRejected(
        uint256 indexed creditId,
        address indexed validator,
        string reason,
        uint256 timestamp
    );

    event CreditTransferred(
        uint256 indexed creditId,
        address indexed from,
        address indexed to,
        uint256 timestamp
    );

    event CreditRetired(
        uint256 indexed creditId,
        address indexed owner,
        uint256 timestamp
    );

    // -------------------------------------------------------------------------
    // Modificadores
    // -------------------------------------------------------------------------

    modifier creditExists(uint256 creditId) {
        require(_credits[creditId].issuedAt != 0, "CCR: credito inexistente");
        _;
    }

    modifier onlyOwner(uint256 creditId) {
        require(_credits[creditId].owner == msg.sender, "CCR: nao e o proprietario");
        _;
    }

    // -------------------------------------------------------------------------
    // Funções de escrita
    // -------------------------------------------------------------------------

    /**
     * @notice Emite um novo crédito de carbono.
     */
    function issueCredit(
        string calldata areaName,
        string calldata location,
        string calldata geoCoordinates,
        uint256 co2Tonnes
    ) external returns (uint256) {
        require(bytes(areaName).length > 0, "CCR: nome da area obrigatorio");
        require(co2Tonnes > 0, "CCR: quantidade de CO2 deve ser positiva");

        uint256 creditId = _nextCreditId++;
        _credits[creditId] = CarbonCredit({
            id: creditId,
            areaName: areaName,
            location: location,
            geoCoordinates: geoCoordinates,
            co2Tonnes: co2Tonnes,
            issuer: msg.sender,
            owner: msg.sender,
            validator: address(0),
            issuedAt: block.timestamp,
            status: CreditStatus.Created
        });
        _creditIds.push(creditId);

        _recordEvent(creditId, "CreditIssued", msg.sender, "");

        emit CreditIssued(creditId, msg.sender, areaName, co2Tonnes, block.timestamp);
        return creditId;
    }

    /**
     * @notice Valida um crédito no estado Created.
     */
    function validateCredit(uint256 creditId)
        external
        creditExists(creditId)
    {
        CarbonCredit storage credit = _credits[creditId];
        require(
            credit.status == CreditStatus.Created,
            "CCR: apenas creditos no estado Created podem ser validados"
        );

        credit.status = CreditStatus.Validated;
        credit.validator = msg.sender;

        _recordEvent(creditId, "CreditValidated", msg.sender, "");

        emit CreditValidated(creditId, msg.sender, block.timestamp);
    }

    /**
     * @notice Rejeita um crédito no estado Created.
     */
    function rejectCredit(uint256 creditId, string calldata reason)
        external
        creditExists(creditId)
    {
        CarbonCredit storage credit = _credits[creditId];
        require(
            credit.status == CreditStatus.Created,
            "CCR: apenas creditos no estado Created podem ser rejeitados"
        );

        credit.status = CreditStatus.Rejected;
        credit.validator = msg.sender;

        _recordEvent(creditId, "CreditRejected", msg.sender, reason);

        emit CreditRejected(creditId, msg.sender, reason, block.timestamp);
    }

    /**
     * @notice Transfere um crédito validado para outro endereço.
     *         Apenas o proprietário atual pode transferir.
     */
    function transferCredit(uint256 creditId, address to)
        external
        creditExists(creditId)
        onlyOwner(creditId)
    {
        require(to != address(0), "CCR: destinatario invalido");
        CarbonCredit storage credit = _credits[creditId];
        require(credit.status != CreditStatus.Retired, "CCR: credito aposentado nao pode ser transferido");
        require(
            credit.status == CreditStatus.Validated ||
            credit.status == CreditStatus.Transferred,
            "CCR: apenas creditos validados ou transferidos podem ser transferidos"
        );

        address from = credit.owner;
        credit.owner = to;
        credit.status = CreditStatus.Transferred;

        _recordEvent(creditId, "CreditTransferred", msg.sender, _addressToString(to));

        emit CreditTransferred(creditId, from, to, block.timestamp);
    }

    /**
     * @notice Aposenta (retira) um crédito. Apenas o proprietário pode aposentar.
     *         Créditos aposentados não podem ser transferidos.
     */
    function retireCredit(uint256 creditId)
        external
        creditExists(creditId)
        onlyOwner(creditId)
    {
        CarbonCredit storage credit = _credits[creditId];
        require(
            credit.status == CreditStatus.Validated ||
            credit.status == CreditStatus.Transferred,
            "CCR: apenas creditos validados ou transferidos podem ser aposentados"
        );

        credit.status = CreditStatus.Retired;

        _recordEvent(creditId, "CreditRetired", msg.sender, "");

        emit CreditRetired(creditId, msg.sender, block.timestamp);
    }

    // -------------------------------------------------------------------------
    // Funções de leitura
    // -------------------------------------------------------------------------

    function getCredit(uint256 creditId)
        external
        view
        creditExists(creditId)
        returns (CarbonCredit memory)
    {
        return _credits[creditId];
    }

    function getTotalCredits() external view returns (uint256) {
        return _creditIds.length;
    }

    function getCreditIds() external view returns (uint256[] memory) {
        return _creditIds;
    }

    function getAuditLog() external view returns (CreditEvent[] memory) {
        return _auditLog;
    }

    function getCreditEvents(uint256 creditId)
        external
        view
        returns (CreditEvent[] memory)
    {
        uint256 count;
        for (uint256 i = 0; i < _auditLog.length; i++) {
            if (_auditLog[i].creditId == creditId) count++;
        }
        CreditEvent[] memory events = new CreditEvent[](count);
        uint256 idx;
        for (uint256 i = 0; i < _auditLog.length; i++) {
            if (_auditLog[i].creditId == creditId) {
                events[idx++] = _auditLog[i];
            }
        }
        return events;
    }

    // -------------------------------------------------------------------------
    // Funções internas
    // -------------------------------------------------------------------------

    function _recordEvent(
        uint256 creditId,
        string memory eventType,
        address actor,
        string memory metadata
    ) internal {
        _auditLog.push(CreditEvent({
            creditId: creditId,
            eventType: eventType,
            actor: actor,
            timestamp: block.timestamp,
            metadata: metadata
        }));
    }

    function _addressToString(address addr) internal pure returns (string memory) {
        bytes memory b = new bytes(42);
        b[0] = '0';
        b[1] = 'x';
        for (uint256 i = 0; i < 20; i++) {
            bytes1 byteVal = bytes1(uint8(uint160(addr) >> (8 * (19 - i))));
            b[2 + i * 2]     = _nibbleToChar(uint8(byteVal) >> 4);
            b[2 + i * 2 + 1] = _nibbleToChar(uint8(byteVal) & 0x0f);
        }
        return string(b);
    }

    function _nibbleToChar(uint8 nibble) internal pure returns (bytes1) {
        if (nibble < 10) return bytes1(nibble + 48);
        return bytes1(nibble + 87);
    }
}
