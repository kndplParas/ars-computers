/**
 * Test Suite: Order Audit Reconciliation Verification
 * Tests RPC security, metadata constraints, function ACLs via aclexplode, idempotency, preflight rollback, and financial immutability.
 *
 * All database tests execute inside rollback-only transactions or disposable assertions,
 * ensuring ZERO records are committed or left behind.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  checkEnvironmentSafety,
  buildReconciliationSql,
  EnvironmentSafetyError,
  EXPECTED_CONTAINER
} from '../scripts/reconcile-local-payment-fixtures.js';

function runPsql(sql, expectSuccess = true) {
  try {
    return execFileSync('docker', [
      'exec',
      EXPECTED_CONTAINER,
      'psql',
      '-U', 'postgres',
      '-d', 'postgres',
      '-v', 'ON_ERROR_STOP=1',
      '-t', '-A',
      '-c', sql
    ], { encoding: 'utf8' }).trim();
  } catch (err) {
    if (expectSuccess) {
      throw new Error(`PSQL execution failed: ${err.stderr || err.message}`);
    }
    return err.stderr || err.message;
  }
}

// Global baseline count verification across entire test run (runs even on test failure)
let suiteInitialCount;

test.before(() => {
  suiteInitialCount = runPsql("SELECT count(*) FROM public.order_activities WHERE activity_type = 'ORDER_AUDIT_RECONCILIATION';");
});

test.after(() => {
  const suiteFinalCount = runPsql("SELECT count(*) FROM public.order_activities WHERE activity_type = 'ORDER_AUDIT_RECONCILIATION';");
  assert.equal(
    suiteFinalCount,
    suiteInitialCount,
    'Suite-wide rollback verification failed: persistent audit activity rows were left behind!'
  );
});

test('1. Environment Safety Unit Tests (In-memory, zero process.exit, zero production calls)', async () => {
  // A. HTTPS protocol rejection (with local hostname so protocol check triggers)
  assert.throws(() => {
    checkEnvironmentSafety({
      env: { VITE_SUPABASE_URL: 'https://127.0.0.1:54321' },
      fileExists: () => false,
      dockerInspect: () => []
    });
  }, (err) => err instanceof EnvironmentSafetyError && /Insecure or non-http protocol/.test(err.message));

  // B. Remote HTTP hostname rejection (with http protocol so hostname check triggers)
  assert.throws(() => {
    checkEnvironmentSafety({
      env: { VITE_SUPABASE_URL: 'http://pthxyolerxlktkrbzkms.supabase.co:54321' },
      fileExists: () => false,
      dockerInspect: () => []
    });
  }, (err) => err instanceof EnvironmentSafetyError && /Remote or non-local hostname/.test(err.message));

  // C. Unexpected port rejection
  assert.throws(() => {
    checkEnvironmentSafety({
      env: { VITE_SUPABASE_URL: 'http://127.0.0.1:8080' },
      fileExists: () => false,
      dockerInspect: () => []
    });
  }, (err) => err instanceof EnvironmentSafetyError && /Unexpected port/.test(err.message));

  // D. Embedded credentials rejection
  assert.throws(() => {
    checkEnvironmentSafety({
      env: { VITE_SUPABASE_URL: 'http://user:pass@127.0.0.1:54321' },
      fileExists: () => false,
      dockerInspect: () => []
    });
  }, (err) => err instanceof EnvironmentSafetyError && /Embedded credentials detected/.test(err.message));

  // E. Path rejection
  assert.throws(() => {
    checkEnvironmentSafety({
      env: { VITE_SUPABASE_URL: 'http://127.0.0.1:54321/api' },
      fileExists: () => false,
      dockerInspect: () => []
    });
  }, (err) => err instanceof EnvironmentSafetyError && /Unexpected path/.test(err.message));

  // F. Conflicting URLs rejection
  assert.throws(() => {
    checkEnvironmentSafety({
      env: {
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        SUPABASE_URL: 'http://localhost:54321'
      },
      fileExists: () => false,
      dockerInspect: () => []
    });
  }, (err) => err instanceof EnvironmentSafetyError && /Conflicting environment variables/.test(err.message));

  // G. Forbidden production file rejection (with absolute path check)
  assert.throws(() => {
    checkEnvironmentSafety({
      env: { VITE_SUPABASE_URL: 'http://127.0.0.1:54321' },
      fileExists: (f) => f.includes('.env.production'),
      dockerInspect: () => []
    });
  }, (err) => err instanceof EnvironmentSafetyError && /Forbidden production environment file/.test(err.message));

  // H. Docker container stopped rejection
  assert.throws(() => {
    checkEnvironmentSafety({
      env: { VITE_SUPABASE_URL: 'http://127.0.0.1:54321' },
      fileExists: () => false,
      dockerInspect: () => [{ State: { Running: false } }]
    });
  }, (err) => err instanceof EnvironmentSafetyError && /is not running/.test(err.message));

  // I. Docker project label mismatch
  assert.throws(() => {
    checkEnvironmentSafety({
      env: { VITE_SUPABASE_URL: 'http://127.0.0.1:54321' },
      fileExists: () => false,
      dockerInspect: () => [{
        State: { Running: true },
        Config: { Labels: { 'com.supabase.cli.project': 'WrongProject' } }
      }]
    });
  }, (err) => err instanceof EnvironmentSafetyError && /project label mismatch/.test(err.message));

  // J. Docker workdir mismatch
  assert.throws(() => {
    checkEnvironmentSafety({
      env: { VITE_SUPABASE_URL: 'http://127.0.0.1:54321' },
      fileExists: () => false,
      dockerInspect: () => [{
        State: { Running: true },
        Config: {
          Labels: {
            'com.supabase.cli.project': 'ARS_Computers',
            'com.supabase.cli.workdir': 'D:\\OtherProject'
          }
        }
      }]
    });
  }, (err) => err instanceof EnvironmentSafetyError && /workdir mismatch/.test(err.message));

  // K. Docker port binding mismatch
  assert.throws(() => {
    checkEnvironmentSafety({
      env: { VITE_SUPABASE_URL: 'http://127.0.0.1:54321' },
      fileExists: () => false,
      dockerInspect: () => [{
        State: { Running: true },
        Config: {
          Labels: {
            'com.supabase.cli.project': 'ARS_Computers',
            'com.supabase.cli.workdir': 'C:\\ARS Computers'
          }
        },
        NetworkSettings: { Ports: { '5432/tcp': [] } }
      }]
    });
  }, (err) => err instanceof EnvironmentSafetyError && /port binding mismatch/.test(err.message));
});

test('2. Input validation unit tests for overrideFixture2Amount in buildReconciliationSql', async () => {
  // Valid amounts
  assert.ok(buildReconciliationSql({ overrideFixture2Amount: '5000.00' }).includes('5000.00'));
  assert.ok(buildReconciliationSql({ overrideFixture2Amount: '2500' }).includes('2500'));
  assert.ok(buildReconciliationSql({ overrideFixture2Amount: '10.5' }).includes('10.5'));

  // Invalid amounts: zero, negative, excessive precision, malformed, injection
  const invalidAmounts = [
    '0',
    '0.00',
    '-5000.00',
    '5000.001',
    'abc',
    '',
    '   ',
    'NaN',
    '5000; DROP TABLE orders;',
    '5000 OR 1=1'
  ];

  for (const inv of invalidAmounts) {
    assert.throws(
      () => buildReconciliationSql({ overrideFixture2Amount: inv }),
      /Invalid overrideFixture2Amount/,
      `Expected validation error for: "${inv}"`
    );
  }
});

test('3. Exact function signature and ACL verification via catalog and aclexplode (overload-immune)', async () => {
  // A. Verify exact identity arguments from pg_proc using regprocedure OID lookup
  const sigSql = `
    SELECT oidvectortypes(p.proargtypes)
    FROM pg_proc p
    WHERE p.oid = 'public.record_order_audit_reconciliation(uuid, uuid, text, jsonb)'::regprocedure;
  `;
  const argTypes = runPsql(sigSql);
  assert.equal(argTypes, 'uuid, uuid, text, jsonb', 'Function arguments must strictly match signature (uuid, uuid, text, jsonb)');

  // B. Verify ACLs using aclexplode(p.proacl) filtered by exact regprocedure OID
  const aclSql = `
    SELECT
      COALESCE((a).grantee::regrole::text, 'PUBLIC') AS grantee_name,
      (a).grantee AS grantee_oid,
      (a).privilege_type
    FROM pg_proc p
    CROSS JOIN LATERAL aclexplode(p.proacl) a
    WHERE p.oid = 'public.record_order_audit_reconciliation(uuid, uuid, text, jsonb)'::regprocedure;
  `;
  const rawOutput = runPsql(aclSql);
  const rows = rawOutput.split('\n').filter(Boolean).map(line => {
    const [grantee_name, grantee_oid, privilege_type] = line.split('|');
    return { grantee_name, grantee_oid: Number(grantee_oid), privilege_type };
  });

  const publicGrant = rows.find(r => r.grantee_oid === 0 || r.grantee_name === 'PUBLIC');
  assert.equal(publicGrant, undefined, 'PUBLIC (grantee 0) must NOT have any execute privilege');

  const anonGrant = rows.find(r => r.grantee_name === 'anon');
  assert.equal(anonGrant, undefined, 'anon role must NOT have any execute privilege');

  const serviceRoleGrant = rows.find(r => r.grantee_name === 'service_role');
  assert.equal(serviceRoleGrant, undefined, 'service_role must NOT have execute privilege (revoked explicitly)');

  const authGrant = rows.find(r => r.grantee_name === 'authenticated');
  assert.ok(authGrant, 'authenticated role must be present in proacl');
  assert.equal(authGrant.privilege_type, 'EXECUTE', 'authenticated role must have EXECUTE privilege');

  const postgresGrant = rows.find(r => r.grantee_name === 'postgres');
  assert.ok(postgresGrant, 'postgres role must have EXECUTE privilege');
});

test('4. Metadata constraint isolation: strictly verifies SQLSTATE 23514 and exact constraint name', async () => {
  // All cases supply non-null jsonb so they never fail column NOT NULL constraint (23502)
  // All cases supply valid existing order_id so they never fail FK constraint (23503)
  const invalidCases = [
    { desc: 'JSON null literal', val: "'null'::jsonb" },
    { desc: 'Array metadata', val: "'[1, 2, 3]'::jsonb" },
    { desc: 'Scalar string metadata', val: "'\"string\"'::jsonb" },
    { desc: 'Scalar number metadata', val: "'123'::jsonb" },
    { desc: 'Scalar boolean metadata', val: "'true'::jsonb" },
    { desc: 'Missing payment_id', val: "'{\"foo\": \"bar\"}'::jsonb" },
    { desc: 'JSON null payment_id', val: "'{\"payment_id\": null}'::jsonb" },
    { desc: 'Empty string payment_id', val: "'{\"payment_id\": \"\"}'::jsonb" },
    { desc: 'Whitespace payment_id', val: "'{\"payment_id\": \"   \"}'::jsonb" },
    { desc: 'Malformed UUID payment_id', val: "'{\"payment_id\": \"not-a-valid-uuid\"}'::jsonb" }
  ];

  for (const c of invalidCases) {
    const testSql = `
      DO $$
      DECLARE
        v_caught BOOLEAN := false;
        v_sqlstate TEXT;
        v_cname TEXT;
      BEGIN
        BEGIN
          INSERT INTO public.order_activities (
            order_id, activity_type, metadata
          ) VALUES (
            '8fc67381-a84b-44cc-a492-57092f7e33ea'::uuid,
            'ORDER_AUDIT_RECONCILIATION',
            ${c.val}
          );
        EXCEPTION
          WHEN check_violation THEN
            GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_cname = CONSTRAINT_NAME;
            IF v_sqlstate = '23514' AND v_cname = 'chk_order_activities_reconciliation_payment_id' THEN
              v_caught := true;
            ELSE
              RAISE EXCEPTION 'WRONG_CHECK_CONSTRAINT: state=%, constraint=%', v_sqlstate, v_cname;
            END IF;
        END;

        IF NOT v_caught THEN
          RAISE EXCEPTION 'TEST_FAILED: Invalid metadata insert unexpectedly succeeded without throwing check_violation for case "%"', '${c.desc}';
        END IF;
      END $$;
    `;
    const output = runPsql(testSql, true);
    assert.equal(output, 'DO', `Case "${c.desc}" must cleanly satisfy SQLSTATE 23514 on chk_order_activities_reconciliation_payment_id`);
  }
});

test('5. Preflight failure on second fixture rolls back completely leaving ZERO rows committed', async () => {
  const countBefore = runPsql("SELECT count(*) FROM public.order_activities WHERE activity_type = 'ORDER_AUDIT_RECONCILIATION';");

  // Generate real script SQL but with Fixture 2 asserting mismatched expected amount 9999.00
  const mismatchedSql = buildReconciliationSql({ overrideFixture2Amount: '9999.00' });
  const errOutput = runPsql(mismatchedSql, false);

  assert.match(errOutput, /Preflight verification failed for Fixture 2 Payment/, 'Preflight mismatch must abort transaction');

  const countAfter = runPsql("SELECT count(*) FROM public.order_activities WHERE activity_type = 'ORDER_AUDIT_RECONCILIATION';");
  assert.equal(countBefore, countAfter, 'Rollback ensures ZERO reconciliation rows are committed');
});

test('6. Unique index duplicate test leaves ZERO records behind (rollback-only)', async () => {
  const countBefore = runPsql("SELECT count(*) FROM public.order_activities WHERE activity_type = 'ORDER_AUDIT_RECONCILIATION';");

  const dupSql = `
    BEGIN;
    -- 1. First INSERT supplies all required columns and valid references; must succeed
    INSERT INTO public.order_activities (
      order_id, actor_role, activity_type, content, metadata
    ) VALUES (
      '8fc67381-a84b-44cc-a492-57092f7e33ea'::uuid,
      'database_system',
      'ORDER_AUDIT_RECONCILIATION',
      'Test initial reconciliation',
      '{"payment_id": "fbca29ca-df5b-424d-bceb-bb3958306c7c"}'::jsonb
    );

    -- 2. Second INSERT with identical (order_id, payment_id) must fail specifically on unique index
    DO $$
    DECLARE
      v_caught_dup BOOLEAN := false;
      v_sqlstate TEXT;
      v_cname TEXT;
    BEGIN
      BEGIN
        INSERT INTO public.order_activities (
          order_id, actor_role, activity_type, content, metadata
        ) VALUES (
          '8fc67381-a84b-44cc-a492-57092f7e33ea'::uuid,
          'database_system',
          'ORDER_AUDIT_RECONCILIATION',
          'Test duplicate reconciliation',
          '{"payment_id": "fbca29ca-df5b-424d-bceb-bb3958306c7c"}'::jsonb
        );
      EXCEPTION
        WHEN unique_violation THEN
          GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_cname = CONSTRAINT_NAME;
          IF v_sqlstate = '23505' AND v_cname = 'uq_order_activities_audit_reconciliation' THEN
            v_caught_dup := true;
          ELSE
            RAISE EXCEPTION 'WRONG_UNIQUE_CONSTRAINT: state=%, constraint=%', v_sqlstate, v_cname;
          END IF;
      END;

      IF NOT v_caught_dup THEN
        RAISE EXCEPTION 'TEST_FAILED: Duplicate reconciliation INSERT unexpectedly succeeded!';
      END IF;
    END $$;

    ROLLBACK; -- Discards first insert, leaving zero rows committed
  `;
  const output = runPsql(dupSql, true);
  const tags = output.split('\n').map(l => l.trim()).filter(Boolean);
  assert.deepEqual(
    tags,
    ['BEGIN', 'INSERT 0 1', 'DO', 'ROLLBACK'],
    'Transaction must begin, insert 1 row, cleanly catch 23505 on duplicate in DO block, and rollback'
  );

  const countAfter = runPsql("SELECT count(*) FROM public.order_activities WHERE activity_type = 'ORDER_AUDIT_RECONCILIATION';");
  assert.equal(countBefore, countAfter, 'Rollback ensures persistent reconciliation count remains completely unchanged');
});

test('7. RPC operational verification: preconditions, sanitization, tampering rejection, and immutability', async () => {
  const rpcTestsSql = `
    BEGIN;
    DO $$
    DECLARE
      v_superadmin_id UUID;
      v_superadmin_email TEXT;
      v_emp_id UUID;
      v_res JSONB;
      v_act_meta JSONB;

      -- Financial snapshots before RPC
      v_ord_paid_before NUMERIC;
      v_ord_total_before NUMERIC;
      v_ord_status_before TEXT;
      v_ord_updated_before TIMESTAMPTZ;
      v_pay_amount_before NUMERIC;
      v_pay_method_before TEXT;
      v_pay_ref_before TEXT;
      v_pay_recby_before UUID;
      v_pay_recat_before TIMESTAMPTZ;

      -- Financial snapshots after RPC
      v_ord_paid_after NUMERIC;
      v_ord_total_after NUMERIC;
      v_ord_status_after TEXT;
      v_ord_updated_after TIMESTAMPTZ;
      v_pay_amount_after NUMERIC;
      v_pay_method_after TEXT;
      v_pay_ref_after TEXT;
      v_pay_recby_after UUID;
      v_pay_recat_after TIMESTAMPTZ;
    BEGIN
      -- Precondition assertion: Verify test accounts exist without hardcoded credentials
      SELECT id, email INTO v_superadmin_id, v_superadmin_email
      FROM public.admin_users WHERE role = 'superadmin' AND is_active = true LIMIT 1;

      IF v_superadmin_id IS NULL THEN
        RAISE EXCEPTION 'Precondition failed: No active superadmin account found in database';
      END IF;

      SELECT id INTO v_emp_id
      FROM public.admin_users WHERE role = 'engineer' AND is_active = true LIMIT 1;

      IF v_emp_id IS NULL THEN
        RAISE EXCEPTION 'Precondition failed: No active engineer account found in database';
      END IF;

      -- Capture financial state before RPC
      SELECT paid_amount, total_amount, payment_status, updated_at
      INTO v_ord_paid_before, v_ord_total_before, v_ord_status_before, v_ord_updated_before
      FROM public.orders WHERE id = '8fc67381-a84b-44cc-a492-57092f7e33ea'::uuid;

      SELECT amount_received, payment_method, transaction_reference, received_by, received_at
      INTO v_pay_amount_before, v_pay_method_before, v_pay_ref_before, v_pay_recby_before, v_pay_recat_before
      FROM public.order_payments WHERE id = 'fbca29ca-df5b-424d-bceb-bb3958306c7c'::uuid;

      -- Verify harness assertion: Engineer auth.uid() resolution
      PERFORM set_config('request.jwt.claim.sub', v_emp_id::text, true);
      IF auth.uid() IS DISTINCT FROM v_emp_id THEN
        RAISE EXCEPTION 'Harness assertion failed: auth.uid() did not resolve to v_emp_id';
      END IF;

      -- A. Non-superadmin caller rejected
      BEGIN
        PERFORM public.record_order_audit_reconciliation(
          '8fc67381-a84b-44cc-a492-57092f7e33ea'::uuid,
          'fbca29ca-df5b-424d-bceb-bb3958306c7c'::uuid,
          'Substantive reconciliation reason 12345'
        );
        RAISE EXCEPTION 'Non-superadmin should have been rejected with insufficient_privilege';
      EXCEPTION WHEN insufficient_privilege THEN
        -- Expected
      END;

      -- Verify harness assertion: Superadmin auth.uid() resolution
      PERFORM set_config('request.jwt.claim.sub', v_superadmin_id::text, true);
      IF auth.uid() IS DISTINCT FROM v_superadmin_id THEN
        RAISE EXCEPTION 'Harness assertion failed: auth.uid() did not resolve to v_superadmin_id';
      END IF;

      -- B. Array metadata rejected
      BEGIN
        PERFORM public.record_order_audit_reconciliation(
          '8fc67381-a84b-44cc-a492-57092f7e33ea'::uuid,
          'fbca29ca-df5b-424d-bceb-bb3958306c7c'::uuid,
          'Substantive reconciliation reason 12345',
          '[1, 2, 3]'::jsonb
        );
        RAISE EXCEPTION 'Array metadata should have been rejected with check_violation';
      EXCEPTION WHEN check_violation THEN
        -- Expected
      END;

      -- C. Mismatched order/payment ownership rejected
      BEGIN
        PERFORM public.record_order_audit_reconciliation(
          '8fc67381-a84b-44cc-a492-57092f7e33ea'::uuid,
          'a938a146-0901-4fe0-ab1e-d8eb9db52c1c'::uuid, -- Payment belongs to order 2
          'Substantive reconciliation reason 12345'
        );
        RAISE EXCEPTION 'Mismatched order/payment ownership should have been rejected';
      EXCEPTION WHEN check_violation THEN
        -- Expected
      END;

      -- D. Valid execution with caller metadata tampering attempt
      v_res := public.record_order_audit_reconciliation(
        '8fc67381-a84b-44cc-a492-57092f7e33ea'::uuid,
        'fbca29ca-df5b-424d-bceb-bb3958306c7c'::uuid,
        'Substantive reconciliation reason by Superadmin',
        jsonb_build_object(
          'audit_memo', 'Safe memo from caller',
          'ticket_no', 'SEC-99',
          'synthetic_fixture', true,
          'physical_cash_movement', true,
          'payment_id', '00000000-0000-0000-0000-000000000000',
          'reconciled_amount', 999999.99,
          'original_execution_context', 'forged_context',
          'attesting_actor', 'attacker@forged.test'
        )
      );

      IF (v_res->>'success')::boolean <> true THEN
        RAISE EXCEPTION 'RPC returned failure: %', v_res;
      END IF;

      -- Retrieve inserted activity metadata
      SELECT metadata INTO v_act_meta
      FROM public.order_activities
      WHERE id = (v_res->>'activity_id')::uuid;

      -- Assert server-authoritative values (Tampering thwarted)
      IF v_act_meta->>'payment_id' <> 'fbca29ca-df5b-424d-bceb-bb3958306c7c' THEN
        RAISE EXCEPTION 'Authoritative payment_id compromised: %', v_act_meta->>'payment_id';
      END IF;

      IF (v_act_meta->>'reconciled_amount')::numeric <> 5000.00 THEN
        RAISE EXCEPTION 'Authoritative reconciled_amount compromised: %', v_act_meta->>'reconciled_amount';
      END IF;

      -- Assert synthetic_fixture and physical_cash_movement are omitted from generic RPC
      IF v_act_meta ? 'synthetic_fixture' THEN
        RAISE EXCEPTION 'synthetic_fixture should be omitted for generic ledger attestation';
      END IF;

      IF v_act_meta ? 'physical_cash_movement' THEN
        RAISE EXCEPTION 'physical_cash_movement should be omitted for generic ledger attestation';
      END IF;

      IF v_act_meta->>'original_execution_context' <> 'application_superadmin_attestation' THEN
        RAISE EXCEPTION 'Authoritative original_execution_context compromised: %', v_act_meta->>'original_execution_context';
      END IF;

      IF v_act_meta->>'attesting_actor' <> v_superadmin_email THEN
        RAISE EXCEPTION 'Authoritative attesting_actor compromised: %', v_act_meta->>'attesting_actor';
      END IF;

      -- Assert custom_notes preserves caller safe metadata without forged keys
      IF v_act_meta->'custom_notes'->>'audit_memo' <> 'Safe memo from caller' OR
         v_act_meta->'custom_notes'->>'ticket_no' <> 'SEC-99' THEN
        RAISE EXCEPTION 'Safe caller metadata not preserved in custom_notes: %', v_act_meta->'custom_notes';
      END IF;

      IF v_act_meta->'custom_notes' ? 'synthetic_fixture' OR
         v_act_meta->'custom_notes' ? 'physical_cash_movement' OR
         v_act_meta->'custom_notes' ? 'payment_id' OR
         v_act_meta->'custom_notes' ? 'reconciled_amount' THEN
        RAISE EXCEPTION 'Reserved keys were not stripped from custom_notes: %', v_act_meta->'custom_notes';
      END IF;

      -- E. Duplicate execution rejected specifically on unique index
      BEGIN
        PERFORM public.record_order_audit_reconciliation(
          '8fc67381-a84b-44cc-a492-57092f7e33ea'::uuid,
          'fbca29ca-df5b-424d-bceb-bb3958306c7c'::uuid,
          'Substantive reconciliation reason by Superadmin'
        );
        RAISE EXCEPTION 'Duplicate RPC call should have been rejected with unique_violation';
      EXCEPTION WHEN unique_violation THEN
        -- Expected
      END;

      -- F. Financial state immutability check after RPC execution
      SELECT paid_amount, total_amount, payment_status, updated_at
      INTO v_ord_paid_after, v_ord_total_after, v_ord_status_after, v_ord_updated_after
      FROM public.orders WHERE id = '8fc67381-a84b-44cc-a492-57092f7e33ea'::uuid;

      SELECT amount_received, payment_method, transaction_reference, received_by, received_at
      INTO v_pay_amount_after, v_pay_method_after, v_pay_ref_after, v_pay_recby_after, v_pay_recat_after
      FROM public.order_payments WHERE id = 'fbca29ca-df5b-424d-bceb-bb3958306c7c'::uuid;

      IF v_ord_paid_before <> v_ord_paid_after OR
         v_ord_total_before <> v_ord_total_after OR
         v_ord_status_before <> v_ord_status_after OR
         v_ord_updated_before <> v_ord_updated_after OR
         v_pay_amount_before <> v_pay_amount_after OR
         v_pay_method_before <> v_pay_method_after OR
         v_pay_ref_before <> v_pay_ref_after OR
         v_pay_recby_before IS DISTINCT FROM v_pay_recby_after OR
         v_pay_recat_before <> v_pay_recat_after THEN
        RAISE EXCEPTION 'Financial immutability violation detected after RPC call';
      END IF;

    END $$;
    ROLLBACK; -- Ensures zero records remain committed
  `;
  runPsql(rpcTestsSql);
});

